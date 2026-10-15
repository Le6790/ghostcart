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
})
