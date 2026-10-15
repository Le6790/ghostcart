import { Hono } from 'hono'
import type { Category, Summary } from '../../shared/schemas.ts'
import type { AppEnv } from '../auth.ts'
import { today } from '../dates.ts'
import { activeGoal, liveProgress, toGoal } from '../goals.ts'

export const summary = new Hono<AppEnv>()

summary.get('/', (c) => {
  const db = c.get('db')
  const { id } = c.get('user')
  const now = today()
  const monthStart = now.slice(0, 7) + '-01'

  const totals = db
    .prepare(
      `SELECT COALESCE(SUM(amount_cents), 0) AS totalCents,
              COALESCE(SUM(CASE WHEN skipped_at >= ? THEN amount_cents END), 0) AS monthCents,
              COUNT(*) AS count
       FROM entries WHERE user_id = ? AND status = 'skipped'`,
    )
    .get(monthStart, id) as { totalCents: number; monthCents: number; count: number }

  const top = db
    .prepare(
      `SELECT category, SUM(amount_cents) AS cents FROM entries
       WHERE user_id = ? AND status = 'skipped' GROUP BY category ORDER BY cents DESC LIMIT 1`,
    )
    .get(id) as { category: Category; cents: number } | undefined

  const g = activeGoal(db, id)
  const goalOut: Summary['goal'] = g ? { ...toGoal(g), ...liveProgress(db, id, g) } : null

  const { n: readyToDecide } = db
    .prepare(
      `SELECT COUNT(*) AS n FROM entries
       WHERE user_id = ? AND status = 'tempted' AND decide_by <= ?`,
    )
    .get(id, now) as { n: number }

  const out: Summary = { ...totals, today: now, readyToDecide, topCategory: top ?? null, goal: goalOut }
  return c.json(out)
})
