// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from './api.ts'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)
afterEach(() => fetchMock.mockReset())

const ok = (data: unknown, status = 200) => ({ ok: true, status, json: async () => data })

describe('api client', () => {
  it('GETs summary', async () => {
    fetchMock.mockResolvedValue(ok({ totalCents: 5 }))
    expect(await api.summary()).toEqual({ totalCents: 5 })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/summary')
  })

  it('builds a query string and drops empty filters', async () => {
    fetchMock.mockResolvedValue(ok([]))
    await api.entries({ category: 'dining', from: '', to: '2026-10-01' })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/entries?category=dining&to=2026-10-01')
    await api.entries({})
    expect(fetchMock.mock.calls[1][0]).toBe('/api/entries')
  })

  it('POSTs a JSON body', async () => {
    fetchMock.mockResolvedValue(ok({ id: 1 }, 201))
    const entry = { title: 'x', amountCents: 100, category: 'other' as const, skippedAt: '2026-10-01' }
    await api.addEntry(entry)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/entries')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual(entry)
  })

  it('PUTs the goal and DELETEs', async () => {
    fetchMock.mockResolvedValue(ok({}))
    await api.setGoal({ name: 'Trip', targetCents: 100 })
    expect(fetchMock.mock.calls[0][1].method).toBe('PUT')
    fetchMock.mockResolvedValue({ ok: true, status: 204 })
    expect(await api.clearGoal()).toBeUndefined()
    expect(fetchMock.mock.calls[1][1].method).toBe('DELETE')
    await api.deleteEntry(7)
    expect(fetchMock.mock.calls[2][0]).toBe('/api/entries/7')
  })

  it('throws on non-2xx', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 })
    await expect(api.summary()).rejects.toThrow('GET /summary failed (500)')
  })
})
