import { Hono } from 'hono'
import { z } from 'zod'
import { TREND_PERIODS, type TrendPeriod, type TrendPoint } from '../../shared/schemas.ts'
import type { AppEnv } from '../auth.ts'

export const trend = new Hono<AppEnv>()

const DAY = 86_400_000
const DEFAULT_COUNT: Record<TrendPeriod, number> = { month: 6, week: 12 }
const MAX_COUNT: Record<TrendPeriod, number> = { month: 24, week: 52 }

const querySchema = z.object({
  period: z.enum(TREND_PERIODS).default('month'),
  count: z.coerce.number().int().min(1).optional(),
})

// Bucket start (YYYY-MM-DD) for a stored skipped_at date, matching bucketStarts() below.
const BUCKET_SQL: Record<TrendPeriod, string> = {
  month: `substr(skipped_at, 1, 7) || '-01'`,
  // strftime('%w') is 0 for Sunday; shift so Monday is day 0.
  week: `date(skipped_at, '-' || ((CAST(strftime('%w', skipped_at) AS INTEGER) + 6) % 7) || ' days')`,
}

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/** The `count` bucket start dates ending with the bucket containing `today`, oldest first. */
function bucketStarts(period: TrendPeriod, count: number, today: string): string[] {
  const t = new Date(`${today}T00:00:00Z`)
  const starts: string[] = []
  if (period === 'month') {
    for (let i = count - 1; i >= 0; i--) {
      starts.push(iso(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - i, 1)))
    }
  } else {
    const monday = t.getTime() - ((t.getUTCDay() + 6) % 7) * DAY
    for (let i = count - 1; i >= 0; i--) starts.push(iso(monday - i * 7 * DAY))
  }
  return starts
}

trend.get('/', (c) => {
  const parsed = querySchema.safeParse(c.req.query())
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400)
  const { period } = parsed.data
  const count = parsed.data.count ?? DEFAULT_COUNT[period]
  if (count > MAX_COUNT[period]) return c.json({ error: `count must be at most ${MAX_COUNT[period]}` }, 400)

  const starts = bucketStarts(period, count, new Date().toISOString().slice(0, 10))
  const rows = c
    .get('db')
    .prepare(
      `SELECT ${BUCKET_SQL[period]} AS start, SUM(amount_cents) AS cents
       FROM entries
       WHERE user_id = ? AND status = 'skipped' AND skipped_at >= ?
       GROUP BY start`,
    )
    .all(c.get('user').id, starts[0]) as { start: string; cents: number }[]

  const byStart = new Map(rows.map((r) => [r.start, r.cents]))
  const out: TrendPoint[] = starts.map((start) => ({ start, totalCents: byStart.get(start) ?? 0 }))
  return c.json(out)
})
