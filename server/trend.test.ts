import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from './app.ts'
import { openDb } from './db.ts'

let app: ReturnType<typeof createApp>
beforeEach(() => {
  // Only fake Date; faking timers would stall the async request handling.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-14T12:00:00Z')) // a Wednesday
  app = createApp(openDb(':memory:'))
})
afterEach(() => vi.useRealTimers())

const h = (login = 'a@x') => ({ 'Tailscale-User-Login': login, 'content-type': 'application/json' })
const add = (title: string, amountCents: number, skippedAt: string, extra: object = {}, login = 'a@x') =>
  app.request('/api/entries', {
    method: 'POST',
    headers: h(login),
    body: JSON.stringify({ title, amountCents, category: 'dining', skippedAt, ...extra }),
  })
const trend = async (qs = '', login = 'a@x') => {
  const res = await app.request(`/api/trend${qs}`, { headers: h(login) })
  return { status: res.status, json: (await res.json()) as any } // eslint-disable-line @typescript-eslint/no-explicit-any
}

describe('/trend', () => {
  it('returns 6 zero-filled months ending with the current one by default', async () => {
    const { status, json } = await trend()
    expect(status).toBe(200)
    expect(json.map((p: { start: string }) => p.start)).toEqual([
      '2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01',
    ])
    expect(json.every((p: { totalCents: number }) => p.totalCents === 0)).toBe(true)
  })

  it('sums skipped entries into their month and ignores older ones', async () => {
    await add('a', 1000, '2026-10-01')
    await add('b', 500, '2026-10-31') // later in the month, still October bucket
    await add('c', 700, '2026-08-15')
    await add('old', 9999, '2025-01-01')
    const { json } = await trend()
    const byStart = Object.fromEntries(json.map((p: { start: string; totalCents: number }) => [p.start, p.totalCents]))
    expect(byStart['2026-10-01']).toBe(1500)
    expect(byStart['2026-08-01']).toBe(700)
    expect(Object.values(byStart).reduce((a: number, b) => a + (b as number), 0)).toBe(2200)
  })

  it('crosses year boundaries', async () => {
    vi.setSystemTime(new Date('2026-02-10T00:00:00Z'))
    const { json } = await trend('?count=4')
    expect(json.map((p: { start: string }) => p.start)).toEqual(['2025-11-01', '2025-12-01', '2026-01-01', '2026-02-01'])
  })

  it('excludes bought and tempted entries', async () => {
    await add('kept', 300, '2026-10-02')
    await add('parked', 5000, '2026-10-02', { status: 'tempted' })
    const slipped = (await (await add('slipped', 900, '2026-10-02')).json()) as { id: number }
    await app.request(`/api/entries/${slipped.id}`, { method: 'PATCH', headers: h(), body: JSON.stringify({ status: 'bought' }) })
    const { json } = await trend()
    expect(json.at(-1).totalCents).toBe(300)
  })

  it('does not include other users', async () => {
    await add('mine', 100, '2026-10-02')
    await add('theirs', 700, '2026-10-02', {}, 'b@x')
    expect((await trend()).json.at(-1).totalCents).toBe(100)
  })

  describe('weekly', () => {
    it('buckets by Monday and returns 12 weeks by default', async () => {
      const { json } = await trend('?period=week')
      expect(json).toHaveLength(12)
      expect(json.at(-1).start).toBe('2026-10-12') // Monday of the current week
      expect(json[0].start).toBe('2026-07-27')
    })

    it('puts Sunday in the previous Monday-based week and Monday in the next', async () => {
      await add('sun', 100, '2026-10-11') // Sunday -> week of 2026-10-05
      await add('mon', 200, '2026-10-12') // Monday -> week of 2026-10-12
      await add('wed', 400, '2026-10-14')
      const { json } = await trend('?period=week&count=3')
      expect(json).toEqual([
        { start: '2026-09-28', totalCents: 0 },
        { start: '2026-10-05', totalCents: 100 },
        { start: '2026-10-12', totalCents: 600 },
      ])
    })
  })

  it.each(['?period=year', '?count=0', '?count=25', '?period=week&count=53', '?count=abc'])('rejects %s', async (qs) => {
    expect((await trend(qs)).status).toBe(400)
  })
})
