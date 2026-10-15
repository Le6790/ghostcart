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
  return db
}
