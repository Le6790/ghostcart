import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from './app.ts'
import { openDb } from './db.ts'

let app: ReturnType<typeof createApp>
beforeEach(() => {
  app = createApp(openDb(':memory:'))
})

const base = { 'Tailscale-User-Login': 'a@x' }
const entry = JSON.stringify({ title: 'Sushi', amountCents: 4500, category: 'dining', skippedAt: '2026-10-01' })
const post = (headers: Record<string, string>, body: string = entry) =>
  app.request('/api/entries', { method: 'POST', headers: { ...base, ...headers }, body })
const count = async () =>
  ((await (await app.request('/api/entries', { headers: base })).json()) as unknown[]).length

describe('csrfGuard', () => {
  it('blocks the text/plain "simple request" trick and writes nothing', async () => {
    expect((await post({ 'content-type': 'text/plain' })).status).toBe(415)
    expect((await post({ 'content-type': 'application/x-www-form-urlencoded' })).status).toBe(415)
    expect((await post({})).status).toBe(415)
    expect(await count()).toBe(0)
  })

  it.each(['cross-site', 'same-site'])('blocks Sec-Fetch-Site: %s even with JSON', async (site) => {
    const res = await post({ 'content-type': 'application/json', 'Sec-Fetch-Site': site })
    expect(res.status).toBe(403)
    expect(await count()).toBe(0)
  })

  it.each([undefined, 'same-origin', 'none'])('allows JSON with Sec-Fetch-Site: %s', async (site) => {
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    if (site) headers['Sec-Fetch-Site'] = site
    expect((await post(headers)).status).toBe(201)
  })

  it('accepts a charset parameter', async () => {
    expect((await post({ 'content-type': 'application/json; charset=utf-8' })).status).toBe(201)
  })

  it('does not accept look-alike types', async () => {
    expect((await post({ 'content-type': 'application/jsonp' })).status).toBe(415)
  })

  it('guards PUT, PATCH and DELETE too', async () => {
    for (const [method, path] of [['PUT', '/api/goal'], ['PATCH', '/api/entries/1'], ['DELETE', '/api/entries/1']]) {
      const res = await app.request(path, { method, headers: { ...base, 'Sec-Fetch-Site': 'cross-site', 'content-type': 'application/json' } })
      expect(res.status, `${method} ${path}`).toBe(403)
    }
  })

  it('leaves reads alone, including cross-site GETs (CORS keeps the response unreadable)', async () => {
    const res = await app.request('/api/summary', { headers: { ...base, 'Sec-Fetch-Site': 'cross-site' } })
    expect(res.status).toBe(200)
  })

  it('rejects before auth, so an unauthenticated bad request is 415 not 401', async () => {
    const res = await app.request('/api/entries', { method: 'POST', body: entry })
    expect(res.status).toBe(415)
  })
})
