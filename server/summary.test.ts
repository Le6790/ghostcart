import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from './app.ts'
import { openDb } from './db.ts'

let app: ReturnType<typeof createApp>
let db: ReturnType<typeof openDb>
beforeEach(() => {
  db = openDb(':memory:')
  app = createApp(db)
})

const h = (login: string) => ({ 'Tailscale-User-Login': login, 'content-type': 'application/json' })
const add = (login: string, title: string, amountCents: number, skippedAt: string, category = 'dining') =>
  app.request('/api/entries', {
    method: 'POST',
    headers: h(login),
    body: JSON.stringify({ title, amountCents, category, skippedAt }),
  })
const summary = async (login: string) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (await (await app.request('/api/summary', { headers: h(login) })).json()) as any

const thisMonth = new Date().toISOString().slice(0, 7)

describe('/summary', () => {
  it('is zeroed for a new user', async () => {
    expect(await summary('a@x')).toEqual({
      totalCents: 0,
      monthCents: 0,
      count: 0,
      readyToDecide: 0,
      topCategory: null,
      goal: null,
    })
  })

  it('separates this month from all time', async () => {
    await add('a@x', 'old', 1000, '2020-01-15')
    await add('a@x', 'now', 500, `${thisMonth}-01`)
    const s = await summary('a@x')
    expect(s).toMatchObject({ totalCents: 1500, monthCents: 500, count: 2 })
  })

  it('excludes entries marked as bought from totals, count, top category and goal', async () => {
    await app.request('/api/goal', {
      method: 'PUT',
      headers: h('a@x'),
      body: JSON.stringify({ name: 'Trip', targetCents: 10000 }),
    })
    const started = (await (await app.request('/api/goal', { headers: h('a@x') })).json() as { startedAt: string }).startedAt
    const kept = (await (await add('a@x', 'kept', 300, started, 'dining')).json()) as { status: string }
    const slipped = (await (await add('a@x', 'slipped', 900, started, 'travel')).json()) as { id: number }
    expect(kept.status).toBe('skipped')
    await app.request(`/api/entries/${slipped.id}`, {
      method: 'PATCH',
      headers: h('a@x'),
      body: JSON.stringify({ status: 'bought' }),
    })
    const s = await summary('a@x')
    expect(s).toMatchObject({ totalCents: 300, count: 1, topCategory: { category: 'dining', cents: 300 } })
    expect(s.goal.savedCents).toBe(300)
  })

  it('ignores tempted entries in savings and counts those whose cooldown ended as ready to decide', async () => {
    const park = (title: string, skippedAt: string, cooldownDays: number) =>
      app.request('/api/entries', {
        method: 'POST',
        headers: h('a@x'),
        body: JSON.stringify({ title, amountCents: 5000, category: 'shopping', skippedAt, status: 'tempted', cooldownDays }),
      })
    await park('old want', '2020-01-01', 30) // decide_by 2020-01-31: ready
    await park('new want', new Date().toISOString().slice(0, 10), 30) // not ready
    const s = await summary('a@x')
    expect(s).toMatchObject({ totalCents: 0, count: 0, topCategory: null, readyToDecide: 1 })
  })

  it('picks the top category by total, not by count', async () => {
    await add('a@x', 'a', 100, '2026-10-01', 'dining')
    await add('a@x', 'b', 100, '2026-10-01', 'dining')
    await add('a@x', 'c', 900, '2026-10-01', 'travel')
    expect((await summary('a@x')).topCategory).toEqual({ category: 'travel', cents: 900 })
  })

  it('does not count other users', async () => {
    await add('a@x', 'a', 100, '2026-10-01')
    await add('b@x', 'b', 700, '2026-10-01')
    expect((await summary('a@x')).totalCents).toBe(100)
  })

  describe('goal progress', () => {
    const setGoal = async (login: string, targetCents: number, startedAt = '2026-10-01') => {
      await app.request('/api/goal', {
        method: 'PUT',
        headers: h(login),
        body: JSON.stringify({ name: 'Trip', targetCents }),
      })
      db.prepare('UPDATE goals SET started_at = ?').run(startedAt)
    }

    it('only counts entries on or after the goal start date', async () => {
      await setGoal('a@x', 10000, '2026-10-05')
      await add('a@x', 'before', 4000, '2026-10-04')
      await add('a@x', 'on', 2000, '2026-10-05')
      await add('a@x', 'after', 1000, '2026-10-06')
      expect((await summary('a@x')).goal).toMatchObject({ savedCents: 3000, percent: 30, reached: false })
    })

    it('caps percent at 100 and flags reached', async () => {
      await setGoal('a@x', 1000)
      await add('a@x', 'big', 5000, '2026-10-02')
      expect((await summary('a@x')).goal).toMatchObject({ savedCents: 5000, percent: 100, reached: true })
    })

    it('is 0% with no entries', async () => {
      await setGoal('a@x', 1000)
      expect((await summary('a@x')).goal).toMatchObject({ savedCents: 0, percent: 0, reached: false })
    })
  })
})
