import Database from 'better-sqlite3'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

export type DB = Database.Database

export function openDb(path = process.env.DB_PATH ?? 'ghostcart.db'): DB {
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(readFileSync(join(here, 'schema.sql'), 'utf8'))
  // schema.sql only creates missing tables; add columns introduced later to existing DBs.
  const cols = db.prepare('PRAGMA table_info(entries)').all() as { name: string }[]
  if (!cols.some((c) => c.name === 'status')) {
    db.exec(
      `ALTER TABLE entries ADD COLUMN status TEXT NOT NULL DEFAULT 'skipped' CHECK (status IN ('skipped', 'bought'))`,
    )
  }
  // SQLite can't alter a CHECK constraint, so widening `status` (adding 'tempted') and adding
  // `decide_by` means rebuilding the table. Nothing references entries, so this is safe with FKs on.
  const after = db.prepare('PRAGMA table_info(entries)').all() as { name: string }[]
  if (!after.some((c) => c.name === 'decide_by')) {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE entries_new (
          id           INTEGER PRIMARY KEY,
          user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title        TEXT NOT NULL,
          amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
          category     TEXT NOT NULL,
          note         TEXT,
          skipped_at   TEXT NOT NULL,
          status       TEXT NOT NULL DEFAULT 'skipped' CHECK (status IN ('tempted', 'skipped', 'bought')),
          decide_by    TEXT,
          created_at   TEXT NOT NULL DEFAULT (datetime('now'))
        );
        INSERT INTO entries_new (id, user_id, title, amount_cents, category, note, skipped_at, status, decide_by, created_at)
          SELECT id, user_id, title, amount_cents, category, note, skipped_at, status, NULL, created_at FROM entries;
        DROP TABLE entries;
        ALTER TABLE entries_new RENAME TO entries;
        CREATE INDEX IF NOT EXISTS entries_user_skipped ON entries(user_id, skipped_at);
      `)
    })()
  }
  // goals used to be one row per user (user_id PK). Rebuild into the multi-goal shape; the old row becomes the active goal.
  const goalCols = db.prepare('PRAGMA table_info(goals)').all() as { name: string }[]
  if (!goalCols.some((c) => c.name === 'status')) {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE goals_new (
          id           INTEGER PRIMARY KEY,
          user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name         TEXT NOT NULL,
          target_cents INTEGER NOT NULL CHECK (target_cents > 0),
          started_at   TEXT NOT NULL,
          status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'removed')),
          ended_at     TEXT,
          saved_cents  INTEGER,
          offset_cents INTEGER NOT NULL DEFAULT 0
        );
        INSERT INTO goals_new (user_id, name, target_cents, started_at)
          SELECT user_id, name, target_cents, started_at FROM goals;
        DROP TABLE goals;
        ALTER TABLE goals_new RENAME TO goals;
      `)
    })()
  }
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS goals_one_active ON goals(user_id) WHERE status = 'active'`)
  db.exec(`CREATE INDEX IF NOT EXISTS goals_user_status ON goals(user_id, status)`)
  return db
}
