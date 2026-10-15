import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(import.meta.dirname, '..')
const manifest = JSON.parse(readFileSync(join(root, 'public/manifest.webmanifest'), 'utf8'))
const html = readFileSync(join(root, 'index.html'), 'utf8')

/** Width and height from a PNG's IHDR chunk. */
function pngSize(path: string) {
  const buf = readFileSync(path)
  expect(buf.subarray(1, 4).toString()).toBe('PNG')
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
}

describe('PWA manifest', () => {
  it('is a standalone app starting at /', () => {
    expect(manifest).toMatchObject({ name: 'Ghost Cart', start_url: '/', scope: '/', display: 'standalone' })
  })

  it('declares icons that exist at their stated sizes', () => {
    expect(manifest.icons.length).toBeGreaterThan(0)
    for (const icon of manifest.icons) {
      const [w, h] = icon.sizes.split('x').map(Number)
      expect(pngSize(join(root, 'public', icon.src))).toEqual({ w, h })
    }
  })

  it('has a 180px apple-touch-icon', () => {
    expect(pngSize(join(root, 'public/icons/apple-touch-icon.png'))).toEqual({ w: 180, h: 180 })
  })

  it('is linked from index.html along with the iOS meta tags', () => {
    expect(html).toContain('rel="manifest" href="/manifest.webmanifest"')
    expect(html).toContain('rel="apple-touch-icon" href="/icons/apple-touch-icon.png"')
    expect(html).toContain('name="apple-mobile-web-app-capable" content="yes"')
    expect(html).toContain('name="theme-color"')
  })
})
