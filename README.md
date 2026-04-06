# Series Tracker — Backend

REST API for a personal series/anime tracker.  
Built with **[Elysia](https://elysiajs.com/)** on **[Bun](https://bun.sh/)** and **[libSQL / Turso](https://turso.tech/)** as the serverless database.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun |
| Framework | Elysia |
| Database | libSQL (Turso — serverless SQLite) |
| Docs | Swagger UI (OpenAPI 3) |

---

## Quick start (local)

### 1. Prerequisites

```bash
curl -fsSL https://bun.sh/install | bash
```

### 2. Clone & install

```bash
git clone https://github.com/Sistemas-y-Tecnologias-Web-1-2026/Proyecto-1-Full-Stack---Backend
cd Proyecto-1-Full-Stack---Backend
bun install
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env if needed. By default it uses a local SQLite file.
```

For a Turso cloud database:
```
TURSO_DATABASE_URL=libsql://<db-name>-<org>.turso.io
TURSO_AUTH_TOKEN=<your-token>
```

### 4. Run

```bash
bun run dev      # development (with hot reload)
bun run start    # production
```

The API starts at **http://localhost:3000**  
Swagger docs: **http://localhost:3000/docs**

---

## API Endpoints

### Series

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| `GET` | `/series` | List all series | 200 |
| `GET` | `/series/:id` | Get single series | 200 / 404 |
| `POST` | `/series` | Create series | 201 / 400 |
| `PUT` | `/series/:id` | Update series | 200 / 400 / 404 |
| `DELETE` | `/series/:id` | Delete series | 204 / 404 |
| `POST` | `/series/:id/image` | Upload cover image | 200 / 400 / 404 |

### Ratings

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| `POST` | `/series/:id/rating` | Add a rating (0–10) | 201 / 404 |
| `GET` | `/series/:id/rating` | Get ratings + average | 200 / 404 |
| `DELETE` | `/series/:id/rating/:ratingId` | Delete a rating | 204 / 404 |

### Query parameters for `GET /series`

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page (max 100) |
| `q` | string | – | Search by name (partial match) |
| `sort` | string | `id` | Sort field: `id`, `name`, `current_episode`, `total_episodes`, `status`, `created_at` |
| `order` | `asc`/`desc` | `asc` | Sort direction |

---

## CORS

Cross-Origin Resource Sharing (CORS) is a browser security mechanism that blocks JavaScript from making requests to a different origin (domain, port, or protocol) than the one that served the page.

This server is configured to **allow all origins** during development:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

---

## Challenges implemented

- [x] OpenAPI/Swagger spec written with Elysia's type system
- [x] Swagger UI served from the backend at `/docs`
- [x] Correct HTTP status codes (201, 204, 400, 404, 500)
- [x] Server-side validation with descriptive JSON error responses
- [x] Pagination (`?page=`, `?limit=`)
- [x] Search by name (`?q=`)
- [x] Sorting (`?sort=`, `?order=asc|desc`)
- [x] Rating system (separate table, REST endpoints)
- [x] Image upload (multipart/form-data, ≤ 1.5 MB)

---

## Project structure

```
src/
├── index.ts        # App entry, plugin registration, error handler
├── db.ts           # libSQL client + schema migration
├── schemas.ts      # Elysia/TypeBox validation schemas
└── routes/
    ├── series.ts   # Series CRUD + image upload
    └── ratings.ts  # Rating endpoints
```

---

## Reflection

**Bun + Elysia** turned out to be an excellent combination. Elysia's TypeBox-based validation is baked in — you write the schema once and get both compile-time types and runtime validation for free. The DX is much closer to a "batteries-included" experience than raw Node/Express.

**libSQL / Turso** makes the serverless story simple: the same `@libsql/client` works with a local file in dev and with the Turso cloud in production with a single env-var change. No migration tooling required for a project this size.

Would I use this stack again? Absolutely for side-projects and hackathons. For a large team I'd probably add a schema migration tool (Drizzle ORM works great with Turso) and stricter linting.

---

## Links

- Frontend repo: _add link here_
- Live deployment: _add link here_
