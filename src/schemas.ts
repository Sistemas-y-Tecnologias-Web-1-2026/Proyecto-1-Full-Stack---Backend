import { t } from "elysia";

export const ALLOWED_SORT_FIELDS = ["id", "name", "current_episode", "total_episodes", "status", "created_at"] as const;
export type SortField = (typeof ALLOWED_SORT_FIELDS)[number];

// ── Series ────────────────────────────────────────────────────────────────────

export const SeriesBody = t.Object({
  name: t.String({ minLength: 1 }),
  genre: t.Optional(t.String()),
  status: t.Optional(
    t.Union([
      t.Literal("watching"),
      t.Literal("completed"),
      t.Literal("dropped"),
      t.Literal("plan_to_watch"),
    ])
  ),
  current_episode: t.Optional(t.Number({ minimum: 0 })),
  total_episodes: t.Optional(t.Number({ minimum: 0 })),
  synopsis: t.Optional(t.String()),
  image_url: t.Optional(t.String()),
});

export const SeriesUpdateBody = t.Object({
  name: t.Optional(t.String({ minLength: 1 })),
  genre: t.Optional(t.String()),
  status: t.Optional(
    t.Union([
      t.Literal("watching"),
      t.Literal("completed"),
      t.Literal("dropped"),
      t.Literal("plan_to_watch"),
    ])
  ),
  current_episode: t.Optional(t.Number({ minimum: 0 })),
  total_episodes: t.Optional(t.Number({ minimum: 0 })),
  synopsis: t.Optional(t.String()),
  image_url: t.Optional(t.String()),
});

export const SeriesParams = t.Object({ id: t.Numeric() });

export const SeriesQuery = t.Object({
  page: t.Optional(t.Numeric({ minimum: 1 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
  q: t.Optional(t.String()),
  sort: t.Optional(
    t.Union([
      t.Literal("id"),
      t.Literal("name"),
      t.Literal("current_episode"),
      t.Literal("total_episodes"),
      t.Literal("status"),
      t.Literal("created_at"),
    ])
  ),
  order: t.Optional(t.Union([t.Literal("asc"), t.Literal("desc")])),
});

// ── Rating ────────────────────────────────────────────────────────────────────

export const RatingBody = t.Object({
  score: t.Number({ minimum: 0, maximum: 10 }),
  review: t.Optional(t.String()),
});
