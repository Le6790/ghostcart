import { Hono } from 'hono'
import type { Category, Goal, Summary } from '../../shared/schemas.ts'
import type { AppEnv } from '../auth.ts'

export const summary = new Hono<AppEnv>()

summary.get('/', (c) => {
  const db = c.get('db')
  const { id } = c.get('user')
  const monthStart = new Date().toISOString().slice(0, 7) + '-01'

  const totals = db
    .prepare(
      `SELECT COALESCE(SUM(amount_cents), 0) AS totalCents,
              COALESCE(SUM(CASE WHEN skipped_at >= ? THEN amount_cents END), 0) AS monthCents,
              COUNT(*) AS count
       FROM entries WHERE user_id = ?`,
    )
    .get(monthStart, id) as { totalCents: number; monthCents: number; count: number }

  const top = db
    .prepare(
      `SELECT category, SUM(amount_cents) AS cents FROM entries
       WHERE user_id = ? GROUP BY category ORDER BY cents DESC LIMIT 1`,
    )
    .get(id) as { category: Category; cents: number } | undefined

  const g = db
    .prepare('SELECT name, target_cents AS targetCents, started_at AS startedAt FROM goals WHERE user_id = ?')
    .get(id) as Goal | undefined

  let goalOut: Summary['goal'] = null
  if (g) {
    const { s } = db
      .prepare(
        'SELECT COALESCE(SUM(amount_cents), 0) AS s FROM entries WHERE user_id = ? AND skipped_at >= ?',
      )
      .get(id, g.startedAt) as { s: number }
    goalOut = {
      ...g,
      savedCents: s,
      percent: Math.min(100, Math.round((s / g.targetCents) * 100)),
      reached: s >= g.targetCents,
    }
  }

  const out: Summary = { ...totals, topCategory: top ?? null, goal: goalOut }
  return c.json(out)
})
