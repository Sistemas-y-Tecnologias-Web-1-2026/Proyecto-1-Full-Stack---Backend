import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { initDb } from "./db";
import { seriesRoutes, ensureUploadsDir } from "./routes/series";
import { ratingsRoutes } from "./routes/ratings";
import { existsSync } from "fs";
import { join } from "path";

const PORT = Number(process.env.PORT ?? 3000);
const UPLOADS_DIR = join(process.cwd(), "uploads");

// Initialise DB schema and uploads directory once at startup
await initDb();
ensureUploadsDir();

// In production, restrict CORS to the configured frontend origin.
// During development (no FRONTEND_URL set) all origins are allowed.
const corsOrigin = process.env.FRONTEND_URL ?? true;

const app = new Elysia()
  // ── CORS ─────────────────────────────────────────────────────────────────────
  // `origin: true` tells @elysiajs/cors to echo back whatever Origin the client
  // sends — effectively allowing all origins.  In production, FRONTEND_URL is
  // set to restrict this to the known frontend domain.
  .use(
    cors({
      origin: corsOrigin,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  )

  // ── Swagger / OpenAPI ─────────────────────────────────────────────────────────
  .use(
    swagger({
      path: "/docs",
      documentation: {
        info: {
          title: "Series Tracker API",
          version: "1.0.0",
          description:
            "REST API for managing a personal series/anime tracker. Built with Elysia + Bun + libSQL (Turso).",
        },
        tags: [
          { name: "Series", description: "CRUD operations for series" },
          { name: "Ratings", description: "Rating management per series" },
        ],
      },
    })
  )

  // ── Global error handler (must be before route plugins) ───────────────────────
  .onError(({ code, error, set }) => {
    if (code === "VALIDATION") {
      set.status = 400;
      // Parse Elysia/TypeBox validation error message (it's JSON-serialised)
      let details: unknown = error.message;
      try {
        details = JSON.parse(error.message);
      } catch {
        // leave as-is if it's not valid JSON
      }
      return { error: "Validation error", code: "VALIDATION_ERROR", details };
    }
    if (code === "NOT_FOUND") {
      set.status = 404;
      return { error: "Route not found", code: "NOT_FOUND" };
    }
    set.status = 500;
    return { error: "Internal server error", code: "INTERNAL_ERROR" };
  })

  // ── Static: serve uploaded images ─────────────────────────────────────────────
  .get("/uploads/:filename", async ({ params, set }) => {
    const filepath = join(UPLOADS_DIR, params.filename);
    if (!existsSync(filepath)) {
      set.status = 404;
      return { error: "File not found" };
    }
    return Bun.file(filepath);
  })

  // ── Health check ──────────────────────────────────────────────────────────────
  .get("/health", () => ({ status: "ok", timestamp: new Date().toISOString() }))

  // ── Routes ────────────────────────────────────────────────────────────────────
  .use(seriesRoutes)
  .use(ratingsRoutes)

  .listen(PORT);

console.log(`🦊 Series Tracker API running at http://localhost:${PORT}`);
console.log(`📚 Swagger docs at http://localhost:${PORT}/docs`);

export type App = typeof app;
