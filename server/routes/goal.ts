import { Hono } from 'hono'
import { goalInputSchema, type Goal } from '../../shared/schemas.ts'
import type { AppEnv } from '../auth.ts'

export const goal = new Hono<AppEnv>()

goal.get('/', (c) => {
  const row = c
    .get('db')
    .prepare('SELECT name, target_cents AS targetCents, started_at AS startedAt FROM goals WHERE user_id = ?')
    .get(c.get('user').id) as Goal | undefined
  return c.json(row ?? null)
})

goal.put('/', async (c) => {
  const parsed = goalInputSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400)
  const row = c
    .get('db')
    .prepare(
      `INSERT INTO goals (user_id, name, target_cents, started_at)
       VALUES (?, ?, ?, date('now'))
       ON CONFLICT(user_id) DO UPDATE SET name = excluded.name, target_cents = excluded.target_cents
       RETURNING name, target_cents AS targetCents, started_at AS startedAt`,
    )
    .get(c.get('user').id, parsed.data.name, parsed.data.targetCents) as Goal
  return c.json(row)
})

goal.delete('/', (c) => {
  c.get('db').prepare('DELETE FROM goals WHERE user_id = ?').run(c.get('user').id)
  return c.body(null, 204)
})
