import { afterEach, describe, expect, it, vi } from 'vitest'
import { assertTimeZone, timeZone, today } from './dates.ts'
import { createApp } from './app.ts'
import { openDb } from './db.ts'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

// 2026-10-15 03:30 UTC is still the evening of 10-14 in Los Angeles and already the afternoon of 10-15 in Auckland.
const instant = new Date('2026-10-15T03:30:00Z')

describe('today()', () => {
  it('uses APP_TIMEZONE to decide where the day falls', () => {
    vi.stubEnv('APP_TIMEZONE', 'America/Los_Angeles')
    expect(today(instant)).toBe('2026-10-14')
    vi.stubEnv('APP_TIMEZONE', 'Pacific/Auckland')
    expect(today(instant)).toBe('2026-10-15')
    vi.stubEnv('APP_TIMEZONE', 'UTC')
    expect(today(instant)).toBe('2026-10-15')
  })

  it('falls back to TZ when APP_TIMEZONE is unset', () => {
    vi.stubEnv('APP_TIMEZONE', '')
    vi.stubEnv('TZ', 'America/Los_Angeles')
    expect(timeZone()).toBe('America/Los_Angeles')
    expect(today(instant)).toBe('2026-10-14')
  })

  it('rejects an invalid zone with a clear message', () => {
    vi.stubEnv('APP_TIMEZONE', 'Mars/Olympus')
    expect(() => assertTimeZone()).toThrow(/Invalid timezone "Mars\/Olympus"/)
  })
})

describe('API uses the configured timezone', () => {
  const h = { 'Tailscale-User-Login': 'a@x', 'content-type': 'application/json' }

  it('summary.today, month boundary and trend all follow APP_TIMEZONE', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-01T03:30:00Z')) // Oct 31 evening in LA, Nov 1 in UTC
    const app = createApp(openDb(':memory:'))
    await app.request('/api/entries', {
      method: 'POST',
      headers: h,
      body: JSON.stringify({ title: 'late', amountCents: 500, category: 'dining', skippedAt: '2026-10-31' }),
    })

    vi.stubEnv('APP_TIMEZONE', 'America/Los_Angeles')
    const la = await (await app.request('/api/summary', { headers: h })).json()
    expect(la).toMatchObject({ today: '2026-10-31', monthCents: 500 })
    const laTrend = await (await app.request('/api/trend?count=1', { headers: h })).json()
    expect(laTrend).toEqual([{ start: '2026-10-01', totalCents: 500 }])

    vi.stubEnv('APP_TIMEZONE', 'UTC')
    const utc = await (await app.request('/api/summary', { headers: h })).json()
    expect(utc).toMatchObject({ today: '2026-11-01', monthCents: 0 })
  })

  it('resolving a parked item dates it in the configured timezone', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-01T03:30:00Z'))
    vi.stubEnv('APP_TIMEZONE', 'America/Los_Angeles')
    const app = createApp(openDb(':memory:'))
    const e = (await (
      await app.request('/api/entries', {
        method: 'POST',
        headers: h,
        body: JSON.stringify({ title: 'w', amountCents: 500, category: 'dining', skippedAt: '2026-10-01', status: 'tempted' }),
      })
    ).json()) as { id: number }
    const r = (await (
      await app.request(`/api/entries/${e.id}`, { method: 'PATCH', headers: h, body: JSON.stringify({ status: 'skipped' }) })
    ).json()) as { skippedAt: string }
    expect(r.skippedAt).toBe('2026-10-31')
  })
})
