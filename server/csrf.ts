import type { MiddlewareHandler } from 'hono'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Identity comes from the network (Tailscale), not a cookie, so a browser on the tailnet
 * would "authenticate" any request a malicious page makes. Block that for state-changing calls:
 *  - Sec-Fetch-Site (sent by all modern browsers) must be same-origin or none. This also rejects
 *    "same-site" requests from other devices in the tailnet, which share the ts.net site.
 *  - The body must be declared application/json. A cross-origin page can't send that without a
 *    CORS preflight, and we send no CORS headers, so the preflight fails. This also covers
 *    clients that don't send Sec-Fetch-Site.
 */
export const csrfGuard: MiddlewareHandler = async (c, next) => {
  if (!SAFE_METHODS.has(c.req.method)) {
    const site = c.req.header('Sec-Fetch-Site')
    if (site && site !== 'same-origin' && site !== 'none') {
      return c.json({ error: 'Cross-site request blocked' }, 403)
    }
    const type = (c.req.header('content-type') ?? '').toLowerCase()
    if (!/^application\/json\s*(;|$)/.test(type)) {
      return c.json({ error: 'Content-Type must be application/json' }, 415)
    }
  }
  await next()
}
