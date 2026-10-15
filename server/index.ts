import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { createApp } from './app.ts'
import { openDb } from './db.ts'

const app = createApp(openDb())
app.use('*', serveStatic({ root: './dist' }))
app.get('*', serveStatic({ path: './dist/index.html' }))

const port = Number(process.env.PORT ?? 3000)
// Bind to loopback only: Tailscale identity headers are trusted, so nothing else may reach us.
serve({ fetch: app.fetch, port, hostname: '127.0.0.1' }, () =>
  console.log(`ghost-cart listening on http://127.0.0.1:${port}`),
)
