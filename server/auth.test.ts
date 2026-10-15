import { describe, expect, it } from 'vitest'
import { createApp } from './app.ts'
import { openDb } from './db.ts'

describe('auth middleware', () => {
  it('returns 401 with no header and no dev user', async () => {
    const app = createApp(openDb(':memory:'))
    expect((await app.request('/api/me')).status).toBe(401)
  })

  it('uses Tailscale headers and creates the user once', async () => {
    const db = openDb(':memory:')
    const app = createApp(db)
    const headers = { 'Tailscale-User-Login': 'a@x', 'Tailscale-User-Name': 'Alice' }
    expect(await (await app.request('/api/me', { headers })).json()).toEqual({ login: 'a@x', name: 'Alice' })
    await app.request('/api/me', { headers })
    expect(db.prepare('SELECT COUNT(*) AS n FROM users').get()).toEqual({ n: 1 })
  })

  it('falls back to the name equal to login and updates name changes', async () => {
    const app = createApp(openDb(':memory:'))
    const first = await app.request('/api/me', { headers: { 'Tailscale-User-Login': 'a@x' } })
    expect(await first.json()).toEqual({ login: 'a@x', name: 'a@x' })
    const second = await app.request('/api/me', {
      headers: { 'Tailscale-User-Login': 'a@x', 'Tailscale-User-Name': 'Alice' },
    })
    expect(await second.json()).toEqual({ login: 'a@x', name: 'Alice' })
  })

  it('uses the dev user when no header is sent, but prefers the header', async () => {
    const app = createApp(openDb(':memory:'), 'dev@local')
    expect(await (await app.request('/api/me')).json()).toMatchObject({ login: 'dev@local' })
    const res = await app.request('/api/me', { headers: { 'Tailscale-User-Login': 'b@x' } })
    expect(await res.json()).toMatchObject({ login: 'b@x' })
  })
})
