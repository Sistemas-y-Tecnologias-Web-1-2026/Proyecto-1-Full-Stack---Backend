import Elysia, { t } from "elysia";
import { db } from "../db";
import {
  ALLOWED_SORT_FIELDS,
  SeriesBody,
  SeriesUpdateBody,
  SeriesParams,
  SeriesQuery,
} from "../schemas";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";

const UPLOADS_DIR = join(process.cwd(), "uploads");
const MAX_IMAGE_SIZE = 1.5 * 1024 * 1024; // 1.5 MB

/** Map MIME type → safe file extension (source of truth is MIME, not filename) */
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function ensureUploadsDir(): void {
  if (!existsSync(UPLOADS_DIR)) {
    mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

export const seriesRoutes = new Elysia({ prefix: "/series" })
  // ── GET /series ─────────────────────────────────────────────────────────────
  .get(
    "/",
    async ({ query, set }) => {
      const page = query.page ?? 1;
      const limit = query.limit ?? 20;
      const offset = (page - 1) * limit;
      const q = query.q?.trim() ?? "";
      const sort = query.sort ?? "id";
      const order = query.order ?? "asc";

      const allowedSorts: readonly string[] = ALLOWED_SORT_FIELDS;
      // safeSort is validated against the ALLOWED_SORT_FIELDS allowlist before
      // interpolation — SQL identifiers cannot be parameterised in libSQL.
      const safeSort = allowedSorts.includes(sort) ? sort : "id";
      const safeOrder = order === "desc" ? "DESC" : "ASC";

      let whereClause = "";
      const args: string[] = [];

      if (q) {
        whereClause = "WHERE name LIKE ?";
        args.push(`%${q}%`);
      }

      const countResult = await db.execute({
        sql: `SELECT COUNT(*) AS total FROM series ${whereClause}`,
        args,
      });
      const total = Number((countResult.rows[0] as { total: number }).total);

      const rows = await db.execute({
        sql: `SELECT s.*,
               (SELECT ROUND(AVG(r.score),2) FROM ratings r WHERE r.series_id = s.id) AS avg_rating,
               (SELECT COUNT(*) FROM ratings r WHERE r.series_id = s.id) AS rating_count
              FROM series s
              ${whereClause}
              ORDER BY ${safeSort} ${safeOrder}
              LIMIT ? OFFSET ?`,
        args: [...args, limit, offset],
      });

      set.status = 200;
      return {
        data: rows.rows,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    },
    {
      query: SeriesQuery,
      detail: { summary: "List all series", tags: ["Series"] },
    }
  )

  // ── GET /series/:id ──────────────────────────────────────────────────────────
  .get(
    "/:id",
    async ({ params, set }) => {
      const result = await db.execute({
        sql: `SELECT s.*,
               (SELECT ROUND(AVG(r.score),2) FROM ratings r WHERE r.series_id = s.id) AS avg_rating,
               (SELECT COUNT(*) FROM ratings r WHERE r.series_id = s.id) AS rating_count
              FROM series s WHERE s.id = ?`,
        args: [params.id],
      });

      if (result.rows.length === 0) {
        set.status = 404;
        return { error: "Series not found", code: "NOT_FOUND" };
      }

      set.status = 200;
      return { data: result.rows[0] };
    },
    {
      params: SeriesParams,
      detail: { summary: "Get series by ID", tags: ["Series"] },
    }
  )

  // ── POST /series ─────────────────────────────────────────────────────────────
  .post(
    "/",
    async ({ body, set }) => {
      const {
        name,
        genre = "",
        status = "watching",
        current_episode = 0,
        total_episodes = 0,
        synopsis = "",
        image_url = "",
      } = body;

      if (total_episodes > 0 && current_episode > total_episodes) {
        set.status = 400;
        return {
          error: "current_episode cannot exceed total_episodes",
          code: "VALIDATION_ERROR",
        };
      }

      const result = await db.execute({
        sql: `INSERT INTO series (name, genre, status, current_episode, total_episodes, synopsis, image_url)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [name, genre, status, current_episode, total_episodes, synopsis, image_url],
      });

      const newSeries = await db.execute({
        sql: "SELECT * FROM series WHERE id = ?",
        args: [result.lastInsertRowid],
      });

      set.status = 201;
      return { data: newSeries.rows[0] };
    },
    {
      body: SeriesBody,
      detail: { summary: "Create a new series", tags: ["Series"] },
    }
  )

  // ── PUT /series/:id ──────────────────────────────────────────────────────────
  .put(
    "/:id",
    async ({ params, body, set }) => {
      const existing = await db.execute({
        sql: "SELECT * FROM series WHERE id = ?",
        args: [params.id],
      });

      if (existing.rows.length === 0) {
        set.status = 404;
        return { error: "Series not found", code: "NOT_FOUND" };
      }

      const current = existing.rows[0] as Record<string, unknown>;
      const {
        name = current.name as string,
        genre = current.genre as string,
        status = current.status as string,
        current_episode = current.current_episode as number,
        total_episodes = current.total_episodes as number,
        synopsis = current.synopsis as string,
        image_url = current.image_url as string,
      } = body;

      if (total_episodes > 0 && current_episode > total_episodes) {
        set.status = 400;
        return {
          error: "current_episode cannot exceed total_episodes",
          code: "VALIDATION_ERROR",
        };
      }

      await db.execute({
        sql: `UPDATE series
              SET name = ?, genre = ?, status = ?, current_episode = ?,
                  total_episodes = ?, synopsis = ?, image_url = ?,
                  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
              WHERE id = ?`,
        args: [name, genre, status, current_episode, total_episodes, synopsis, image_url, params.id],
      });

      const updated = await db.execute({
        sql: "SELECT * FROM series WHERE id = ?",
        args: [params.id],
      });

      set.status = 200;
      return { data: updated.rows[0] };
    },
    {
      params: SeriesParams,
      body: SeriesUpdateBody,
      detail: { summary: "Update a series", tags: ["Series"] },
    }
  )

  // ── DELETE /series/:id ───────────────────────────────────────────────────────
  .delete(
    "/:id",
    async ({ params, set }) => {
      const existing = await db.execute({
        sql: "SELECT id FROM series WHERE id = ?",
        args: [params.id],
      });

      if (existing.rows.length === 0) {
        set.status = 404;
        return { error: "Series not found", code: "NOT_FOUND" };
      }

      await db.execute({
        sql: "DELETE FROM series WHERE id = ?",
        args: [params.id],
      });

      set.status = 204;
      return;
    },
    {
      params: SeriesParams,
      detail: { summary: "Delete a series", tags: ["Series"] },
    }
  )

  // ── POST /series/:id/image ───────────────────────────────────────────────────
  .post(
    "/:id/image",
    async ({ params, body, set, request }) => {
      const existing = await db.execute({
        sql: "SELECT id FROM series WHERE id = ?",
        args: [params.id],
      });

      if (existing.rows.length === 0) {
        set.status = 404;
        return { error: "Series not found", code: "NOT_FOUND" };
      }

      const file = (body as { image: File }).image;
      if (!file || !(file instanceof File)) {
        set.status = 400;
        return { error: "image file is required", code: "VALIDATION_ERROR" };
      }

      if (file.size > MAX_IMAGE_SIZE) {
        set.status = 400;
        return { error: "Image must be smaller than 1.5 MB", code: "VALIDATION_ERROR" };
      }

      const ext = MIME_TO_EXT[file.type];
      if (!ext) {
        set.status = 400;
        return { error: "Only JPEG, PNG, WEBP, and GIF images are allowed", code: "VALIDATION_ERROR" };
      }

      const filename = `series_${params.id}_${Date.now()}.${ext}`;
      const filepath = join(UPLOADS_DIR, filename);

      const buffer = await file.arrayBuffer();
      await Bun.write(filepath, buffer);

      const host = request.headers.get("host") ?? "localhost:3000";
      const protocol = request.headers.get("x-forwarded-proto") ?? "http";
      const imageUrl = `${protocol}://${host}/uploads/${filename}`;

      await db.execute({
        sql: "UPDATE series SET image_url = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?",
        args: [imageUrl, params.id],
      });

      const updated = await db.execute({
        sql: "SELECT * FROM series WHERE id = ?",
        args: [params.id],
      });

      set.status = 200;
      return { data: updated.rows[0] };
    },
    {
      params: SeriesParams,
      body: t.Object({ image: t.File() }),
      type: "multipart/form-data",
      detail: { summary: "Upload a cover image for a series", tags: ["Series"] },
    }
  );
