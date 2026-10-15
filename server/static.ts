import { serveStatic } from '@hono/node-server/serve-static'
import type { Hono } from 'hono'
import type { AppEnv } from './auth.ts'

/**
 * Serve the built frontend, falling back to index.html for client-side routes like /trends.
 *
 * index.html names the hashed JS/CSS bundles, so it is sent `Cache-Control: no-cache` (always
 * revalidate). Otherwise a browser, notably iOS Safari / Home Screen apps, can keep an old copy that
 * points at bundles a rebuild has since removed. The hashed assets themselves keep default caching.
 *
 * The header is set after serveStatic runs: its `onFound` hook fires too late to change headers.
 */
export function serveFrontend(app: Hono<AppEnv>, root = './dist') {
  app.use('*', async (c, next) => {
    await next()
    if (c.res.ok && c.res.headers.get('content-type')?.startsWith('text/html')) {
      c.res.headers.set('Cache-Control', 'no-cache')
    }
  })
  app.use('*', serveStatic({ root }))
  app.get('*', serveStatic({ root, path: 'index.html' }))
}
