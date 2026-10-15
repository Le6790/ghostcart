import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from './app.ts'
import { openDb } from './db.ts'
import { serveFrontend } from './static.ts'

let dir: string
let app: ReturnType<typeof createApp>

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'ghostcart-dist-'))
  mkdirSync(join(dir, 'assets'))
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>Ghost Cart</title>')
  writeFileSync(join(dir, 'assets', 'app-abc123.js'), 'console.log(1)')
  app = createApp(openDb(':memory:'))
  serveFrontend(app, dir)
})
afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe('serveFrontend', () => {
  it.each(['/', '/index.html', '/trends', '/some/unknown/route'])('serves index.html for %s with no-cache', async (path) => {
    const res = await app.request(path)
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('<title>Ghost Cart</title>')
    expect(res.headers.get('cache-control')).toBe('no-cache')
  })

  it('serves hashed assets without forcing revalidation', async () => {
    const res = await app.request('/assets/app-abc123.js')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('console.log(1)')
    expect(res.headers.get('cache-control')).toBeNull()
  })

  it('does not shadow the API', async () => {
    const res = await app.request('/api/me', { headers: { 'Tailscale-User-Login': 'a@x' } })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ login: 'a@x' })
  })
})
