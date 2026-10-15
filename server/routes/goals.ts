import { Hono } from 'hono'
import type { AppEnv } from '../auth.ts'
import { activeGoal, toGoal, toHistoryItem, type GoalRow } from '../goals.ts'

/** Goal history: completed and removed goals, newest first. */
export const goals = new Hono<AppEnv>()

goals.get('/', (c) => {
  const rows = c
    .get('db')
    .prepare(
      `SELECT * FROM goals WHERE user_id = ? AND status != 'active'
       ORDER BY ended_at DESC, id DESC`,
    )
    .all(c.get('user').id) as GoalRow[]
  return c.json(rows.map(toHistoryItem))
})

/** Undo for remove and complete: bring a past goal back, as long as no other goal is active. */
goals.post('/:id/restore', (c) => {
  const db = c.get('db')
  const userId = c.get('user').id
  const row = db
    .prepare(`SELECT * FROM goals WHERE id = ? AND user_id = ? AND status != 'active'`)
    .get(Number(c.req.param('id')), userId) as GoalRow | undefined
  if (!row) return c.json({ error: 'Not found' }, 404)
  if (activeGoal(db, userId)) return c.json({ error: 'Finish or remove your current goal first' }, 409)
  const restored = db
    .prepare(`UPDATE goals SET status = 'active', ended_at = NULL, saved_cents = NULL WHERE id = ? RETURNING *`)
    .get(row.id) as GoalRow
  return c.json(toGoal(restored))
})
