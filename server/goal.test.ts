import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from './app.ts'
import { openDb } from './db.ts'

let app: ReturnType<typeof createApp>
beforeEach(() => {
  app = createApp(openDb(':memory:'))
})

const call = (login: string, method = 'GET', body?: unknown) =>
  app.request('/api/goal', {
    method,
    headers: { 'Tailscale-User-Login': login, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const json = async (r: Response) => (await r.json()) as any

describe('/goal', () => {
  it('is null before one is set', async () => {
    expect(await json(await call('a@x'))).toBeNull()
  })

  it('creates a goal starting today', async () => {
    const g = await json(await call('a@x', 'PUT', { name: 'Trip', targetCents: 50000 }))
    expect(g).toMatchObject({ name: 'Trip', targetCents: 50000 })
    expect(g.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('keeps one goal per user and preserves startedAt when edited', async () => {
    const db = openDb(':memory:')
    app = createApp(db)
    await call('a@x', 'PUT', { name: 'Trip', targetCents: 50000 })
    db.prepare("UPDATE goals SET started_at = '2026-01-01'").run()
    const g = await json(await call('a@x', 'PUT', { name: 'Car', targetCents: 90000 }))
    expect(g).toEqual({ id: expect.any(Number), name: 'Car', targetCents: 90000, startedAt: '2026-01-01' })
    expect(db.prepare('SELECT COUNT(*) AS n FROM goals').get()).toEqual({ n: 1 })
  })

  it('validates input', async () => {
    expect((await call('a@x', 'PUT', { name: '', targetCents: 100 })).status).toBe(400)
    expect((await call('a@x', 'PUT', { name: 'x', targetCents: -1 })).status).toBe(400)
  })

  it('deletes a goal and is idempotent', async () => {
    await call('a@x', 'PUT', { name: 'Trip', targetCents: 100 })
    expect((await call('a@x', 'DELETE')).status).toBe(204)
    expect(await json(await call('a@x'))).toBeNull()
    expect((await call('a@x', 'DELETE')).status).toBe(204)
  })

  it('isolates goals between users', async () => {
    await call('a@x', 'PUT', { name: 'Trip', targetCents: 100 })
    expect(await json(await call('b@x'))).toBeNull()
    await call('b@x', 'DELETE')
    expect(await json(await call('a@x'))).toMatchObject({ name: 'Trip' })
  })
})
