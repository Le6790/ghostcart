import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from './app.ts'
import { openDb } from './db.ts'

let app: ReturnType<typeof createApp>

beforeEach(() => {
  app = createApp(openDb(':memory:'))
})

const as = (login: string) => ({ 'Tailscale-User-Login': login, 'content-type': 'application/json' })
const post = (login: string, path: string, body: unknown, method = 'POST') =>
  app.request(`/api${path}`, { method, headers: as(login), body: JSON.stringify(body) })
const get = (login: string, path: string) => app.request(`/api${path}`, { headers: as(login) })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const j = async (r: Response) => (await r.json()) as any

const entry = { title: 'Sushi', amountCents: 4500, category: 'dining', skippedAt: '2026-10-01' }

describe('api', () => {
  it('rejects unauthenticated requests', async () => {
    expect((await app.request('/api/entries')).status).toBe(401)
  })

  it('validates input', async () => {
    expect((await post('a@x', '/entries', { ...entry, amountCents: -5 })).status).toBe(400)
    expect((await post('a@x', '/entries', { ...entry, amountCents: 1.5 })).status).toBe(400)
  })

  it('isolates data between users', async () => {
    const created = await j(await post('a@x', '/entries', entry))
    expect(await j(await get('b@x', '/entries'))).toEqual([])
    expect((await post('b@x', `/entries/${created.id}`, { title: 'x' }, 'PATCH')).status).toBe(404)
    expect((await app.request(`/api/entries/${created.id}`, { method: 'DELETE', headers: as('b@x') })).status).toBe(404)
    expect(await j(await get('a@x', '/entries'))).toHaveLength(1)
  })

  it('computes summary and goal progress', async () => {
    await post('a@x', '/goal', { name: 'Trip', targetCents: 10000 }, 'PUT')
    const { startedAt } = await j(await get('a@x', '/goal'))
    await post('a@x', '/entries', { ...entry, skippedAt: startedAt })
    await post('a@x', '/entries', { ...entry, title: 'Shoes', category: 'shopping', amountCents: 6000, skippedAt: startedAt })
    const s = await j(await get('a@x', '/summary'))
    expect(s.totalCents).toBe(10500)
    expect(s.count).toBe(2)
    expect(s.topCategory).toEqual({ category: 'shopping', cents: 6000 })
    expect(s.goal).toMatchObject({ savedCents: 10500, percent: 100, reached: true })
  })

  it('filters by category', async () => {
    await post('a@x', '/entries', entry)
    await post('a@x', '/entries', { ...entry, category: 'travel' })
    expect(await j(await get('a@x', '/entries?category=travel'))).toHaveLength(1)
  })
})
