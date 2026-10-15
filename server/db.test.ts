import Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { openDb } from './db.ts'

describe('openDb', () => {
  it('is idempotent when applied twice to the same schema', () => {
    const db = openDb(':memory:')
    expect(() => db.exec(`SELECT 1`)).not.toThrow()
  })

  it('enforces positive amounts and foreign keys', () => {
    const db = openDb(':memory:')
    db.prepare("INSERT INTO users (login, name) VALUES ('a', 'a')").run()
    const insert = (uid: number, cents: number) =>
      db
        .prepare(
          "INSERT INTO entries (user_id, title, amount_cents, category, skipped_at) VALUES (?, 't', ?, 'other', '2026-10-01')",
        )
        .run(uid, cents)
    expect(() => insert(1, 0)).toThrow()
    expect(() => insert(999, 100)).toThrow()
    expect(() => insert(1, 100)).not.toThrow()
  })

  it('cascades deletes from users', () => {
    const db = openDb(':memory:')
    db.prepare("INSERT INTO users (login, name) VALUES ('a', 'a')").run()
    db.prepare("INSERT INTO entries (user_id, title, amount_cents, category, skipped_at) VALUES (1, 't', 5, 'other', '2026-10-01')").run()
    db.prepare("INSERT INTO goals (user_id, name, target_cents, started_at) VALUES (1, 'g', 5, '2026-10-01')").run()
    db.prepare('DELETE FROM users WHERE id = 1').run()
    expect(db.prepare('SELECT COUNT(*) AS n FROM entries').get()).toEqual({ n: 0 })
    expect(db.prepare('SELECT COUNT(*) AS n FROM goals').get()).toEqual({ n: 0 })
  })

  it('migrates a pre-status, pre-cooldown entries table, keeping rows and defaulting them to skipped', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ghostcart-'))
    const path = join(dir, 'old.db')
    try {
      const old = new Database(path)
      old.exec(`
        CREATE TABLE users (id INTEGER PRIMARY KEY, login TEXT NOT NULL UNIQUE, name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
        CREATE TABLE entries (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title TEXT NOT NULL, amount_cents INTEGER NOT NULL CHECK (amount_cents > 0), category TEXT NOT NULL, note TEXT,
          skipped_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
        INSERT INTO users (login, name) VALUES ('a', 'a');
        INSERT INTO entries (user_id, title, amount_cents, category, skipped_at) VALUES (1, 't', 5, 'other', '2026-10-01');
      `)
      old.close()
      const db = openDb(path)
      expect(db.prepare('SELECT id, title, status, decide_by AS decideBy FROM entries').get()).toEqual({
        id: 1,
        title: 't',
        status: 'skipped',
        decideBy: null,
      })
      // the rebuilt table accepts 'tempted' and keeps its user index
      expect(() =>
        db
          .prepare(
            "INSERT INTO entries (user_id, title, amount_cents, category, skipped_at, status, decide_by) VALUES (1, 'w', 5, 'other', '2026-10-01', 'tempted', '2026-10-31')",
          )
          .run(),
      ).not.toThrow()
      expect(
        db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'entries_user_skipped'").get(),
      ).toBeTruthy()
      db.close()
      expect(() => openDb(path).close()).not.toThrow() // re-open is a no-op
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('migrates the old one-goal-per-user table: the row becomes the active goal', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ghostcart-'))
    const path = join(dir, 'old-goals.db')
    try {
      const old = new Database(path)
      old.exec(`
        CREATE TABLE users (id INTEGER PRIMARY KEY, login TEXT NOT NULL UNIQUE, name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
        CREATE TABLE goals (user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL,
          target_cents INTEGER NOT NULL CHECK (target_cents > 0), started_at TEXT NOT NULL);
        INSERT INTO users (login, name) VALUES ('a', 'a');
        INSERT INTO goals VALUES (1, 'Trip', 50000, '2026-10-01');
      `)
      old.close()
      const db = openDb(path)
      expect(db.prepare('SELECT user_id, name, target_cents, started_at, status, offset_cents FROM goals').all()).toEqual([
        { user_id: 1, name: 'Trip', target_cents: 50000, started_at: '2026-10-01', status: 'active', offset_cents: 0 },
      ])
      // only one active goal per user, but any number of ended ones
      const add = (status: string) =>
        db.prepare(`INSERT INTO goals (user_id, name, target_cents, started_at, status) VALUES (1, 'g', 5, '2026-10-02', ?)`).run(status)
      expect(() => add('active')).toThrow()
      expect(() => add('completed')).not.toThrow()
      expect(() => add('removed')).not.toThrow()
      db.close()
      expect(() => openDb(path).close()).not.toThrow()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
