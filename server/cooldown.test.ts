import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from './app.ts'
import { openDb } from './db.ts'

let app: ReturnType<typeof createApp>
beforeEach(() => {
  app = createApp(openDb(':memory:'))
})

const headers = { 'Tailscale-User-Login': 'a@x', 'content-type': 'application/json' }
const call = async (path: string, method: string, body?: unknown) => {
  const res = await app.request(`/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined })
  return { status: res.status, json: res.status === 204 ? null : ((await res.json()) as any) } // eslint-disable-line @typescript-eslint/no-explicit-any
}
const base = { title: 'Jacket', amountCents: 12000, category: 'shopping', skippedAt: '2026-10-01' }
const today = new Date().toISOString().slice(0, 10)

describe('cooldown (tempted entries)', () => {
  it('defaults to skipped with no decideBy', async () => {
    const { status, json } = await call('/entries', 'POST', base)
    expect(status).toBe(201)
    expect(json).toMatchObject({ status: 'skipped', decideBy: null })
  })

  it('parks an entry with a 30-day default cooldown', async () => {
    const { json } = await call('/entries', 'POST', { ...base, status: 'tempted' })
    expect(json).toMatchObject({ status: 'tempted', decideBy: '2026-10-31' })
  })

  it('honours a custom cooldown', async () => {
    const { json } = await call('/entries', 'POST', { ...base, status: 'tempted', cooldownDays: 7 })
    expect(json.decideBy).toBe('2026-10-08')
  })

  it.each([0, 91, 1.5])('rejects cooldownDays=%s', async (cooldownDays) => {
    const { status } = await call('/entries', 'POST', { ...base, status: 'tempted', cooldownDays })
    expect(status).toBe(400)
  })

  it('resolving to skipped clears decideBy and re-dates the entry to today', async () => {
    const { json: e } = await call('/entries', 'POST', { ...base, status: 'tempted' })
    const { json } = await call(`/entries/${e.id}`, 'PATCH', { status: 'skipped' })
    expect(json).toMatchObject({ status: 'skipped', decideBy: null, skippedAt: today })
  })

  it('resolving to bought also clears decideBy', async () => {
    const { json: e } = await call('/entries', 'POST', { ...base, status: 'tempted' })
    const { json } = await call(`/entries/${e.id}`, 'PATCH', { status: 'bought' })
    expect(json).toMatchObject({ status: 'bought', decideBy: null })
  })

  it('keeps an explicit skippedAt when resolving', async () => {
    const { json: e } = await call('/entries', 'POST', { ...base, status: 'tempted' })
    const { json } = await call(`/entries/${e.id}`, 'PATCH', { status: 'skipped', skippedAt: '2026-10-05' })
    expect(json.skippedAt).toBe('2026-10-05')
  })

  it('does not allow moving an entry back to tempted', async () => {
    const { json: e } = await call('/entries', 'POST', base)
    const { status } = await call(`/entries/${e.id}`, 'PATCH', { status: 'tempted' })
    expect(status).toBe(400)
  })

  it('does not touch skippedAt when an ordinary skipped entry is toggled to bought', async () => {
    const { json: e } = await call('/entries', 'POST', base)
    const { json } = await call(`/entries/${e.id}`, 'PATCH', { status: 'bought' })
    expect(json.skippedAt).toBe('2026-10-01')
  })
})
