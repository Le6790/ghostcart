import type { MiddlewareHandler } from 'hono'
import type { DB } from './db.ts'

export interface AppUser {
  id: number
  login: string
  name: string
}

export type AppEnv = { Variables: { user: AppUser; db: DB } }

/**
 * Identifies the caller from the headers `tailscale serve` injects. The server must only
 * listen on 127.0.0.1 so these headers cannot be spoofed from the network.
 * `devUser` (DEV_USER env) is a fallback for local development without Tailscale.
 */
export function authMiddleware(db: DB, devUser = process.env.DEV_USER): MiddlewareHandler<AppEnv> {
  const upsert = db.prepare(
    `INSERT INTO users (login, name) VALUES (?, ?)
     ON CONFLICT(login) DO UPDATE SET name = excluded.name
     RETURNING id, login, name`,
  )
  return async (c, next) => {
    const login = c.req.header('Tailscale-User-Login') ?? devUser
    if (!login) return c.json({ error: 'Unauthenticated' }, 401)
    const name = c.req.header('Tailscale-User-Name') ?? login
    c.set('user', upsert.get(login, name) as AppUser)
    c.set('db', db)
    await next()
  }
}
