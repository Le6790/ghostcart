import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from './app.ts'
import { openDb } from './db.ts'

let app: ReturnType<typeof createApp>
beforeEach(() => {
  app = createApp(openDb(':memory:'), 'a@x')
})

const call = (path: string, method = 'GET', body?: unknown, login?: string) =>
  app.request(`/api/entries${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(login ? { 'Tailscale-User-Login': login } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

const base = { title: 'Sushi', amountCents: 4500, category: 'dining', skippedAt: '2026-10-01' }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const json = async (r: Response) => (await r.json()) as any

describe('POST /entries', () => {
  it('creates an entry and returns it', async () => {
    const res = await call('', 'POST', { ...base, note: 'treat' })
    expect(res.status).toBe(201)
    expect(await json(res)).toMatchObject({ id: 1, title: 'Sushi', amountCents: 4500, note: 'treat' })
  })

  it('defaults note to null', async () => {
    expect((await json(await call('', 'POST', base))).note).toBeNull()
  })

  it('rejects invalid body and malformed JSON', async () => {
    expect((await call('', 'POST', { ...base, category: 'nope' })).status).toBe(400)
    const bad = await app.request('/api/entries', { method: 'POST', body: '{not json' })
    expect(bad.status).toBe(400)
  })
})

describe('GET /entries', () => {
  beforeEach(async () => {
    await call('', 'POST', { ...base, title: 'old', skippedAt: '2026-09-01' })
    await call('', 'POST', { ...base, title: 'mid', skippedAt: '2026-10-01', category: 'travel' })
    await call('', 'POST', { ...base, title: 'new', skippedAt: '2026-10-10' })
  })

  it('orders newest first', async () => {
    expect((await json(await call(''))).map((e: { title: string }) => e.title)).toEqual(['new', 'mid', 'old'])
  })

  it('breaks date ties by newest id', async () => {
    await call('', 'POST', { ...base, title: 'tie', skippedAt: '2026-10-10' })
    expect((await json(await call(''))).map((e: { title: string }) => e.title)[0]).toBe('tie')
  })

  it('filters by category, from, to and combinations', async () => {
    expect(await json(await call('?category=travel'))).toHaveLength(1)
    expect(await json(await call('?from=2026-10-01'))).toHaveLength(2)
    expect(await json(await call('?to=2026-10-01'))).toHaveLength(2)
    expect(await json(await call('?from=2026-10-01&to=2026-10-05&category=dining'))).toHaveLength(0)
    expect(await json(await call('?from=2026-10-01&to=2026-10-05&category=travel'))).toHaveLength(1)
  })

  it('treats category filter as data, not SQL', async () => {
    expect(await json(await call("?category=' OR 1=1 --"))).toEqual([])
  })
})

describe('PATCH /entries/:id', () => {
  it('updates only provided fields', async () => {
    const { id } = await json(await call('', 'POST', base))
    const res = await call(`/${id}`, 'PATCH', { amountCents: 999 })
    expect(await json(res)).toMatchObject({ title: 'Sushi', amountCents: 999 })
  })

  it('can clear a note with null', async () => {
    const { id } = await json(await call('', 'POST', { ...base, note: 'x' }))
    expect((await json(await call(`/${id}`, 'PATCH', { note: null }))).note).toBeNull()
  })

  it('400s on empty or invalid patch, 404s on unknown id', async () => {
    const { id } = await json(await call('', 'POST', base))
    expect((await call(`/${id}`, 'PATCH', {})).status).toBe(400)
    expect((await call(`/${id}`, 'PATCH', { amountCents: -1 })).status).toBe(400)
    expect((await call('/9999', 'PATCH', { title: 'x' })).status).toBe(404)
  })
})

describe('DELETE /entries/:id', () => {
  it('deletes then 404s', async () => {
    const { id } = await json(await call('', 'POST', base))
    expect((await call(`/${id}`, 'DELETE')).status).toBe(204)
    expect((await call(`/${id}`, 'DELETE')).status).toBe(404)
    expect(await json(await call(''))).toEqual([])
  })
})
