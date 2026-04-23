package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

type Series struct {
	ID             int64    `json:"id"`
	Name           string   `json:"name"`
	CurrentEpisode int      `json:"current_episode"`
	TotalEpisodes  int      `json:"total_episodes"`
	ImageURL       string   `json:"image_url"`
	AverageRating  *float64 `json:"average_rating,omitempty"`
}

type SeriesPayload struct {
	Name           string `json:"name"`
	CurrentEpisode int    `json:"current_episode"`
	TotalEpisodes  int    `json:"total_episodes"`
	ImageURL       string `json:"image_url"`
}

type RatingPayload struct {
	Score int `json:"score"`
}

type APIError struct {
	Error   string `json:"error"`
	Details string `json:"details,omitempty"`
}

var db *sql.DB

func main() {
	port := envOrDefault("PORT", "8080")
	sqlitePath := envOrDefault("SQLITE_PATH", "series.db")

	var err error
	db, err = sql.Open("sqlite", "file:"+sqlitePath)
	if err != nil {
		log.Fatal("DB connection error:", err)
	}
	defer db.Close()

	if err = db.Ping(); err != nil {
		log.Fatal("DB ping error:", err)
	}

	if _, err = db.Exec("PRAGMA foreign_keys = ON;"); err != nil {
		log.Fatal("cannot enable foreign keys:", err)
	}

	if err = ensureSchema(db); err != nil {
		log.Fatal("schema setup error:", err)
	}

	if err = os.MkdirAll("uploads", 0755); err != nil {
		log.Fatal("cannot create uploads directory:", err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /series", handleSeriesCollection)
	mux.HandleFunc("POST /series", handleSeriesCollection)
	mux.HandleFunc("GET /series/", handleSeriesItem)
	mux.HandleFunc("PUT /series/", handleSeriesItem)
	mux.HandleFunc("DELETE /series/", handleSeriesItem)
	mux.HandleFunc("POST /upload-image", handleUploadImage)
	mux.HandleFunc("GET /docs", handleDocs)
	mux.HandleFunc("GET /openapi.yaml", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "openapi.yaml")
	})
	mux.Handle("GET /uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir("uploads"))))

	handler := withCORS(withMethodRouter(mux))

	log.Printf("API listening on :%s", port)
	if err = http.ListenAndServe(":"+port, handler); err != nil {
		log.Fatal("server error:", err)
	}
}

func withMethodRouter(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/series/") && strings.HasSuffix(r.URL.Path, "/rating") {
			handleSeriesRatings(w, r)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func handleSeriesCollection(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		listSeries(w, r)
	case http.MethodPost:
		createSeries(w, r)
	default:
		methodNotAllowed(w)
	}
}

func handleSeriesItem(w http.ResponseWriter, r *http.Request) {
	id, ok := parseSeriesID(r.URL.Path)
	if !ok {
		errorJSON(w, http.StatusNotFound, "not_found", "series endpoint not found")
		return
	}

	switch r.Method {
	case http.MethodGet:
		getSeriesByID(w, id)
	case http.MethodPut:
		updateSeries(w, r, id)
	case http.MethodDelete:
		deleteSeries(w, id)
	default:
		methodNotAllowed(w)
	}
}

func handleSeriesRatings(w http.ResponseWriter, r *http.Request) {
	if !strings.HasSuffix(r.URL.Path, "/rating") {
		return
	}

	id, ok := parseSeriesID(strings.TrimSuffix(r.URL.Path, "/rating"))
	if !ok {
		errorJSON(w, http.StatusNotFound, "not_found", "rating endpoint not found")
		return
	}

	switch r.Method {
	case http.MethodGet:
		getRatingSummary(w, id)
	case http.MethodPost:
		createRating(w, r, id)
	default:
		methodNotAllowed(w)
	}
}

func listSeries(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	page := parsePositiveIntOrDefault(r.URL.Query().Get("page"), 1)
	limit := parsePositiveIntOrDefault(r.URL.Query().Get("limit"), 10)
	if limit > 100 {
		limit = 100
	}
	sort := r.URL.Query().Get("sort")
	order := strings.ToLower(r.URL.Query().Get("order"))
	if order != "desc" {
		order = "asc"
	}

	allowedSorts := map[string]string{
		"id":              "s.id",
		"name":            "s.name",
		"current_episode": "s.current_episode",
		"total_episodes":  "s.total_episodes",
		"created_at":      "s.created_at",
	}
	sortColumn, ok := allowedSorts[sort]
	if !ok {
		sortColumn = "s.id"
	}

	offset := (page - 1) * limit
	where := ""
	args := []any{}

	if q != "" {
		where = "WHERE LOWER(s.name) LIKE LOWER(?)"
		args = append(args, "%"+q+"%")
	}

	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM series s %s", where)
	var total int
	if err := db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		errorJSON(w, http.StatusInternalServerError, "db_error", "cannot count series")
		return
	}

	args = append(args, limit, offset)
	query := fmt.Sprintf(`
		SELECT
			s.id,
			s.name,
			s.current_episode,
			s.total_episodes,
			COALESCE(s.image_url, ''),
			CAST(AVG(r.score) AS REAL)
		FROM series s
		LEFT JOIN ratings r ON r.series_id = s.id
		%s
		GROUP BY s.id
		ORDER BY %s %s
		LIMIT ? OFFSET ?
	`, where, sortColumn, strings.ToUpper(order))

	rows, err := db.Query(query, args...)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "db_error", "cannot list series")
		return
	}
	defer rows.Close()

	items := []Series{}
	for rows.Next() {
		var s Series
		var avg sql.NullFloat64
		if err = rows.Scan(&s.ID, &s.Name, &s.CurrentEpisode, &s.TotalEpisodes, &s.ImageURL, &avg); err != nil {
			errorJSON(w, http.StatusInternalServerError, "db_error", "cannot scan series row")
			return
		}
		if avg.Valid {
			s.AverageRating = &avg.Float64
		}
		items = append(items, s)
	}

	totalPages := 0
	if limit > 0 {
		totalPages = (total + limit - 1) / limit
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"data": items,
		"meta": map[string]any{
			"page":        page,
			"limit":       limit,
			"total":       total,
			"total_pages": totalPages,
		},
	})
}

func createSeries(w http.ResponseWriter, r *http.Request) {
	var payload SeriesPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		errorJSON(w, http.StatusBadRequest, "invalid_json", "request body must be valid JSON")
		return
	}

	if msg := validateSeriesPayload(payload); msg != "" {
		errorJSON(w, http.StatusBadRequest, "validation_error", msg)
		return
	}

	var s Series
	err := db.QueryRow(
		`INSERT INTO series (name, current_episode, total_episodes, image_url)
		 VALUES (?, ?, ?, ?)
		 RETURNING id, name, current_episode, total_episodes, COALESCE(image_url, '')`,
		payload.Name,
		payload.CurrentEpisode,
		payload.TotalEpisodes,
		nullableString(payload.ImageURL),
	).Scan(&s.ID, &s.Name, &s.CurrentEpisode, &s.TotalEpisodes, &s.ImageURL)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "db_error", "cannot create series")
		return
	}

	writeJSON(w, http.StatusCreated, s)
}

func getSeriesByID(w http.ResponseWriter, id int64) {
	var s Series
	var avg sql.NullFloat64
	err := db.QueryRow(`
		SELECT
			s.id,
			s.name,
			s.current_episode,
			s.total_episodes,
			COALESCE(s.image_url, ''),
			CAST(AVG(r.score) AS REAL)
		FROM series s
		LEFT JOIN ratings r ON r.series_id = s.id
		WHERE s.id = ?
		GROUP BY s.id
	`, id).Scan(&s.ID, &s.Name, &s.CurrentEpisode, &s.TotalEpisodes, &s.ImageURL, &avg)

	if err == sql.ErrNoRows {
		errorJSON(w, http.StatusNotFound, "not_found", "series not found")
		return
	}
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "db_error", "cannot load series")
		return
	}

	if avg.Valid {
		s.AverageRating = &avg.Float64
	}
	writeJSON(w, http.StatusOK, s)
}

func updateSeries(w http.ResponseWriter, r *http.Request, id int64) {
	var payload SeriesPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		errorJSON(w, http.StatusBadRequest, "invalid_json", "request body must be valid JSON")
		return
	}

	if msg := validateSeriesPayload(payload); msg != "" {
		errorJSON(w, http.StatusBadRequest, "validation_error", msg)
		return
	}

	res, err := db.Exec(
		`UPDATE series
		 SET name = ?,
		     current_episode = ?,
		     total_episodes = ?,
		     image_url = ?,
		     updated_at = CURRENT_TIMESTAMP
		 WHERE id = ?`,
		payload.Name,
		payload.CurrentEpisode,
		payload.TotalEpisodes,
		nullableString(payload.ImageURL),
		id,
	)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "db_error", "cannot update series")
		return
	}

	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		errorJSON(w, http.StatusNotFound, "not_found", "series not found")
		return
	}

	getSeriesByID(w, id)
}

func deleteSeries(w http.ResponseWriter, id int64) {
	res, err := db.Exec("DELETE FROM series WHERE id = ?", id)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "db_error", "cannot delete series")
		return
	}

	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		errorJSON(w, http.StatusNotFound, "not_found", "series not found")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func createRating(w http.ResponseWriter, r *http.Request, seriesID int64) {
	var exists bool
	if err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM series WHERE id = ?)", seriesID).Scan(&exists); err != nil {
		errorJSON(w, http.StatusInternalServerError, "db_error", "cannot validate series")
		return
	}
	if !exists {
		errorJSON(w, http.StatusNotFound, "not_found", "series not found")
		return
	}

	var payload RatingPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		errorJSON(w, http.StatusBadRequest, "invalid_json", "request body must be valid JSON")
		return
	}
	if payload.Score < 0 || payload.Score > 10 {
		errorJSON(w, http.StatusBadRequest, "validation_error", "score must be between 0 and 10")
		return
	}

	if _, err := db.Exec("INSERT INTO ratings (series_id, score) VALUES (?, ?)", seriesID, payload.Score); err != nil {
		errorJSON(w, http.StatusInternalServerError, "db_error", "cannot save rating")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{"message": "rating created"})
}

func getRatingSummary(w http.ResponseWriter, seriesID int64) {
	var average sql.NullFloat64
	var count int
	err := db.QueryRow(`
		SELECT CAST(AVG(score) AS REAL), COUNT(*)
		FROM ratings
		WHERE series_id = ?
	`, seriesID).Scan(&average, &count)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "db_error", "cannot load rating summary")
		return
	}

	response := map[string]any{
		"series_id": seriesID,
		"count":     count,
	}
	if average.Valid {
		response["average"] = average.Float64
	} else {
		response["average"] = nil
	}

	writeJSON(w, http.StatusOK, response)
}

func handleUploadImage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}

	if err := r.ParseMultipartForm(1 << 20); err != nil {
		errorJSON(w, http.StatusBadRequest, "invalid_form", "image is required and must be <= 1MB")
		return
	}

	file, header, err := r.FormFile("image")
	if err != nil {
		errorJSON(w, http.StatusBadRequest, "invalid_form", "field 'image' is required")
		return
	}
	defer file.Close()

	if header.Size > 1<<20 {
		errorJSON(w, http.StatusBadRequest, "validation_error", "image must be <= 1MB")
		return
	}

	filename, err := saveUploadedFile(file, header)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "upload_error", "cannot save image")
		return
	}

	scheme := "http"
	if r.TLS != nil {
		scheme = "https"
	}
	imageURL := fmt.Sprintf("%s://%s/uploads/%s", scheme, r.Host, filename)
	writeJSON(w, http.StatusCreated, map[string]string{"image_url": imageURL})
}

func handleDocs(w http.ResponseWriter, _ *http.Request) {
	html := `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Series Tracker API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: '/openapi.yaml',
        dom_id: '#swagger-ui',
      });
    </script>
  </body>
</html>`
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(html))
}

func parseSeriesID(path string) (int64, bool) {
	clean := strings.Trim(path, "/")
	parts := strings.Split(clean, "/")
	if len(parts) < 2 || parts[0] != "series" {
		return 0, false
	}
	id, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil || id <= 0 {
		return 0, false
	}
	return id, true
}

func validateSeriesPayload(p SeriesPayload) string {
	if strings.TrimSpace(p.Name) == "" {
		return "name is required"
	}
	if p.CurrentEpisode < 1 {
		return "current_episode must be >= 1"
	}
	if p.TotalEpisodes < 1 {
		return "total_episodes must be >= 1"
	}
	if p.CurrentEpisode > p.TotalEpisodes {
		return "current_episode cannot be greater than total_episodes"
	}
	return ""
}

func saveUploadedFile(file multipart.File, header *multipart.FileHeader) (string, error) {
	safeName := strings.ReplaceAll(header.Filename, " ", "_")
	safeName = filepath.Base(safeName)
	filename := fmt.Sprintf("%d_%s", time.Now().UnixNano(), safeName)
	dstPath := filepath.Join("uploads", filename)

	dst, err := os.Create(dstPath)
	if err != nil {
		return "", err
	}
	defer dst.Close()

	if _, err = dst.ReadFrom(file); err != nil {
		return "", err
	}

	return filename, nil
}

func parsePositiveIntOrDefault(raw string, fallback int) int {
	value, err := strconv.Atoi(raw)
	if err != nil || value < 1 {
		return fallback
	}
	return value
}

func nullableString(value string) any {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return value
}

func ensureSchema(db *sql.DB) error {
	schema := `
CREATE TABLE IF NOT EXISTS series (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL,
	current_episode INT NOT NULL CHECK (current_episode >= 1),
	total_episodes INT NOT NULL CHECK (total_episodes >= 1),
	image_url TEXT,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT episode_range CHECK (current_episode <= total_episodes)
);

CREATE TABLE IF NOT EXISTS ratings (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	series_id INTEGER NOT NULL REFERENCES series(id) ON DELETE CASCADE,
	score INT NOT NULL CHECK (score BETWEEN 0 AND 10),
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`
	_, err := db.Exec(schema)
	return err
}

func methodNotAllowed(w http.ResponseWriter) {
	errorJSON(w, http.StatusMethodNotAllowed, "method_not_allowed", "method not allowed for this route")
}

func errorJSON(w http.ResponseWriter, status int, code, details string) {
	writeJSON(w, status, APIError{Error: code, Details: details})
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func envOrDefault(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}
