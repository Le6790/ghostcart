import { Hono } from 'hono'
import { authMiddleware, type AppEnv } from './auth.ts'
import type { DB } from './db.ts'
import { entries } from './routes/entries.ts'
import { goal } from './routes/goal.ts'
import { summary } from './routes/summary.ts'

export function createApp(db: DB, devUser?: string) {
  const app = new Hono<AppEnv>()
  const api = new Hono<AppEnv>()
  api.use('*', authMiddleware(db, devUser))
  api.get('/me', (c) => {
    const { login, name } = c.get('user')
    return c.json({ login, name })
  })
  api.route('/entries', entries)
  api.route('/goal', goal)
  api.route('/summary', summary)
  app.route('/api', api)
  return app
}
