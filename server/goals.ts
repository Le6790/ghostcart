import type { Goal, GoalHistoryItem } from '../shared/schemas.ts'
import type { DB } from './db.ts'

export interface GoalRow {
  id: number
  name: string
  target_cents: number
  started_at: string
  status: 'active' | 'completed' | 'removed'
  ended_at: string | null
  saved_cents: number | null
  offset_cents: number
}

export const toGoal = (r: GoalRow): Goal => ({
  id: r.id,
  name: r.name,
  targetCents: r.target_cents,
  startedAt: r.started_at,
})

export function activeGoal(db: DB, userId: number): GoalRow | undefined {
  return db.prepare(`SELECT * FROM goals WHERE user_id = ? AND status = 'active'`).get(userId) as GoalRow | undefined
}

/** Skipped entries dated on or after `startedAt`, less what was already credited to the previous goal. */
export function savedSince(db: DB, userId: number, startedAt: string, offsetCents = 0): number {
  const { s } = db
    .prepare(
      `SELECT COALESCE(SUM(amount_cents), 0) AS s FROM entries
       WHERE user_id = ? AND status = 'skipped' AND skipped_at >= ?`,
    )
    .get(userId, startedAt) as { s: number }
  return Math.max(0, s - offsetCents)
}

export const progress = (savedCents: number, targetCents: number) => ({
  savedCents,
  percent: Math.min(100, Math.round((savedCents / targetCents) * 100)),
  reached: savedCents >= targetCents,
})

export function liveProgress(db: DB, userId: number, r: GoalRow) {
  return progress(savedSince(db, userId, r.started_at, r.offset_cents), r.target_cents)
}

export function toHistoryItem(r: GoalRow): GoalHistoryItem {
  const saved = r.saved_cents ?? 0
  return {
    ...toGoal(r),
    status: r.status as 'completed' | 'removed',
    endedAt: r.ended_at ?? r.started_at,
    savedCents: saved,
    percent: progress(saved, r.target_cents).percent,
  }
}
