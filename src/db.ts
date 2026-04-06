import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL ?? "file:./series.db";
const authToken = process.env.TURSO_AUTH_TOKEN;

export const db = createClient({ url, authToken });

export async function initDb(): Promise<void> {
  await db.batch([
    `CREATE TABLE IF NOT EXISTS series (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      name      TEXT    NOT NULL,
      genre     TEXT    NOT NULL DEFAULT '',
      status    TEXT    NOT NULL DEFAULT 'watching'
                        CHECK(status IN ('watching','completed','dropped','plan_to_watch')),
      current_episode INTEGER NOT NULL DEFAULT 0,
      total_episodes  INTEGER NOT NULL DEFAULT 0,
      synopsis  TEXT    NOT NULL DEFAULT '',
      image_url TEXT    NOT NULL DEFAULT '',
      created_at TEXT   NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT   NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )`,
    `CREATE TABLE IF NOT EXISTS ratings (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      series_id INTEGER NOT NULL REFERENCES series(id) ON DELETE CASCADE,
      score     REAL    NOT NULL CHECK(score >= 0 AND score <= 10),
      review    TEXT    NOT NULL DEFAULT '',
      created_at TEXT   NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )`,
  ]);
}
