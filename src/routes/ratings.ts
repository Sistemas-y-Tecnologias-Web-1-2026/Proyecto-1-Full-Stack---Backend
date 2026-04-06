import Elysia, { t } from "elysia";
import { db } from "../db";
import { RatingBody, SeriesParams } from "../schemas";

export const ratingsRoutes = new Elysia({ prefix: "/series" })
  // ── POST /series/:id/rating ──────────────────────────────────────────────────
  .post(
    "/:id/rating",
    async ({ params, body, set }) => {
      const existing = await db.execute({
        sql: "SELECT id FROM series WHERE id = ?",
        args: [params.id],
      });

      if (existing.rows.length === 0) {
        set.status = 404;
        return { error: "Series not found", code: "NOT_FOUND" };
      }

      const { score, review = "" } = body;

      const result = await db.execute({
        sql: "INSERT INTO ratings (series_id, score, review) VALUES (?, ?, ?)",
        args: [params.id, score, review],
      });

      const newRating = await db.execute({
        sql: "SELECT * FROM ratings WHERE id = ?",
        args: [result.lastInsertRowid],
      });

      set.status = 201;
      return { data: newRating.rows[0] };
    },
    {
      params: SeriesParams,
      body: RatingBody,
      detail: { summary: "Add a rating to a series", tags: ["Ratings"] },
    }
  )

  // ── GET /series/:id/rating ───────────────────────────────────────────────────
  .get(
    "/:id/rating",
    async ({ params, set }) => {
      const existing = await db.execute({
        sql: "SELECT id FROM series WHERE id = ?",
        args: [params.id],
      });

      if (existing.rows.length === 0) {
        set.status = 404;
        return { error: "Series not found", code: "NOT_FOUND" };
      }

      const ratings = await db.execute({
        sql: "SELECT * FROM ratings WHERE series_id = ? ORDER BY created_at DESC",
        args: [params.id],
      });

      const avg = await db.execute({
        sql: "SELECT ROUND(AVG(score), 2) AS avg_score, COUNT(*) AS count FROM ratings WHERE series_id = ?",
        args: [params.id],
      });

      set.status = 200;
      return {
        data: ratings.rows,
        summary: avg.rows[0],
      };
    },
    {
      params: SeriesParams,
      detail: { summary: "Get ratings for a series", tags: ["Ratings"] },
    }
  )

  // ── DELETE /series/:id/rating/:ratingId ──────────────────────────────────────
  .delete(
    "/:id/rating/:ratingId",
    async ({ params, set }) => {
      const existing = await db.execute({
        sql: "SELECT id FROM ratings WHERE id = ? AND series_id = ?",
        args: [params.ratingId, params.id],
      });

      if (existing.rows.length === 0) {
        set.status = 404;
        return { error: "Rating not found", code: "NOT_FOUND" };
      }

      await db.execute({
        sql: "DELETE FROM ratings WHERE id = ?",
        args: [params.ratingId],
      });

      set.status = 204;
      return;
    },
    {
      params: t.Object({ id: t.Numeric(), ratingId: t.Numeric() }),
      detail: { summary: "Delete a rating", tags: ["Ratings"] },
    }
  );
