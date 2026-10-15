import { Hono } from 'hono'
import { goalInputSchema } from '../../shared/schemas.ts'
import type { AppEnv } from '../auth.ts'
import { today } from '../dates.ts'
import { activeGoal, liveProgress, toGoal, toHistoryItem, type GoalRow } from '../goals.ts'

/** The user's single active goal. Ended goals live under /goals. */
export const goal = new Hono<AppEnv>()

goal.get('/', (c) => {
  const row = activeGoal(c.get('db'), c.get('user').id)
  return c.json(row ? toGoal(row) : null)
})

goal.put('/', async (c) => {
  const parsed = goalInputSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400)
  const db = c.get('db')
  const userId = c.get('user').id
  const { name, targetCents } = parsed.data

  const current = activeGoal(db, userId)
  if (current) {
    // Editing keeps the start date and offset, so progress is unchanged.
    db.prepare('UPDATE goals SET name = ?, target_cents = ? WHERE id = ?').run(name, targetCents, current.id)
    return c.json(toGoal({ ...current, name, target_cents: targetCents }))
  }

  // A goal completed today already took credit for today's skips; don't count them twice in the next one.
  const now = today()
  const completedToday = db
    .prepare(`SELECT 1 FROM goals WHERE user_id = ? AND status = 'completed' AND ended_at = ? LIMIT 1`)
    .get(userId, now)
  const offset = completedToday
    ? (db
        .prepare(
          `SELECT COALESCE(SUM(amount_cents), 0) AS s FROM entries
           WHERE user_id = ? AND status = 'skipped' AND skipped_at >= ?`,
        )
        .get(userId, now) as { s: number }).s
    : 0

  const row = db
    .prepare(
      `INSERT INTO goals (user_id, name, target_cents, started_at, offset_cents)
       VALUES (?, ?, ?, ?, ?) RETURNING *`,
    )
    .get(userId, name, targetCents, now, offset) as GoalRow
  return c.json(toGoal(row))
})

/** Soft delete: the goal moves to history as "removed" and can be restored. Idempotent. */
goal.delete('/', (c) => {
  const db = c.get('db')
  const userId = c.get('user').id
  const current = activeGoal(db, userId)
  if (current) {
    const { savedCents } = liveProgress(db, userId, current)
    db.prepare(`UPDATE goals SET status = 'removed', ended_at = ?, saved_cents = ? WHERE id = ?`).run(
      today(),
      savedCents,
      current.id,
    )
  }
  return c.body(null, 204)
})

/** Archive the active goal as completed. Only allowed once it has been reached. */
goal.post('/complete', (c) => {
  const db = c.get('db')
  const userId = c.get('user').id
  const current = activeGoal(db, userId)
  if (!current) return c.json({ error: 'No active goal' }, 404)
  const { savedCents, reached } = liveProgress(db, userId, current)
  if (!reached) return c.json({ error: 'Goal not reached yet' }, 409)
  const row = db
    .prepare(`UPDATE goals SET status = 'completed', ended_at = ?, saved_cents = ? WHERE id = ? RETURNING *`)
    .get(today(), savedCents, current.id) as GoalRow
  return c.json(toHistoryItem(row))
})
