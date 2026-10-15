import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from './app.ts'
import { openDb } from './db.ts'

let app: ReturnType<typeof createApp>
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-14T12:00:00Z'))
  app = createApp(openDb(':memory:'))
})
afterEach(() => vi.useRealTimers())

const h = (login = 'a@x') => ({ 'Tailscale-User-Login': login, 'content-type': 'application/json' })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type J = any
const call = async (path: string, method = 'GET', body?: unknown, login = 'a@x') => {
  const res = await app.request(`/api${path}`, {
    method,
    headers: h(login),
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: res.status, json: (res.status === 204 ? null : await res.json()) as J }
}
const skip = (amountCents: number, skippedAt = '2026-10-14') =>
  call('/entries', 'POST', { title: 's', amountCents, category: 'dining', skippedAt })
const setGoal = (name: string, targetCents: number) => call('/goal', 'PUT', { name, targetCents })
const summaryGoal = async () => (await call('/summary')).json.goal

describe('completing a goal', () => {
  it('is refused until the goal is reached', async () => {
    await setGoal('Trip', 10000)
    await skip(4000)
    const r = await call('/goal/complete', 'POST')
    expect(r.status).toBe(409)
    expect((await summaryGoal()).name).toBe('Trip')
  })

  it('archives a reached goal with a snapshot, frees the slot, and lists it in history', async () => {
    await setGoal('Trip', 10000)
    await skip(12000)
    const r = await call('/goal/complete', 'POST')
    expect(r.status).toBe(200)
    expect(r.json).toMatchObject({ name: 'Trip', status: 'completed', endedAt: '2026-10-14', savedCents: 12000, percent: 100 })
    expect(await summaryGoal()).toBeNull()
    expect((await call('/goal')).json).toBeNull()
    const hist = (await call('/goals')).json
    expect(hist).toHaveLength(1)
    expect(hist[0]).toMatchObject({ name: 'Trip', status: 'completed' })
  })

  it('keeps the snapshot stable when entries change afterwards', async () => {
    await setGoal('Trip', 10000)
    const e = (await skip(10000)).json
    await call('/goal/complete', 'POST')
    await call(`/entries/${e.id}`, 'DELETE')
    expect((await call('/goals')).json[0].savedCents).toBe(10000)
  })

  it('404s with no active goal', async () => {
    expect((await call('/goal/complete', 'POST')).status).toBe(404)
  })

  it("does not credit today's skips twice to the next goal, but counts later ones", async () => {
    await setGoal('First', 10000)
    await skip(10000) // reaches it today
    await call('/goal/complete', 'POST')
    await setGoal('Second', 5000)
    expect((await summaryGoal()).savedCents).toBe(0)
    await skip(1500)
    expect((await summaryGoal()).savedCents).toBe(1500)
  })

  it('counts everything for the next goal when the previous one ended on an earlier day', async () => {
    await setGoal('First', 10000)
    await skip(10000)
    await call('/goal/complete', 'POST')
    vi.setSystemTime(new Date('2026-10-15T12:00:00Z'))
    await skip(700, '2026-10-15')
    await setGoal('Second', 5000)
    expect((await summaryGoal()).savedCents).toBe(700)
  })
})

describe('removing and restoring (undo)', () => {
  it('remove is a soft delete that shows in history with its snapshot', async () => {
    await setGoal('Trip', 10000)
    await skip(2500)
    expect((await call('/goal', 'DELETE')).status).toBe(204)
    expect(await summaryGoal()).toBeNull()
    const hist = (await call('/goals')).json
    expect(hist[0]).toMatchObject({ name: 'Trip', status: 'removed', savedCents: 2500, percent: 25 })
  })

  it('restores a removed goal with its original start date and live progress', async () => {
    await setGoal('Trip', 10000)
    await skip(2500)
    await call('/goal', 'DELETE')
    const id = (await call('/goals')).json[0].id
    const r = await call(`/goals/${id}/restore`, 'POST')
    expect(r.status).toBe(200)
    expect(r.json).toMatchObject({ id, name: 'Trip', startedAt: '2026-10-14' })
    expect(await summaryGoal()).toMatchObject({ name: 'Trip', savedCents: 2500 })
    expect((await call('/goals')).json).toHaveLength(0)
  })

  it('reopens a completed goal', async () => {
    await setGoal('Trip', 10000)
    await skip(10000)
    await call('/goal/complete', 'POST')
    const id = (await call('/goals')).json[0].id
    expect((await call(`/goals/${id}/restore`, 'POST')).status).toBe(200)
    expect(await summaryGoal()).toMatchObject({ name: 'Trip', reached: true })
  })

  it('refuses to restore while another goal is active', async () => {
    await setGoal('Old', 10000)
    await call('/goal', 'DELETE')
    await setGoal('New', 5000)
    const id = (await call('/goals')).json[0].id
    const r = await call(`/goals/${id}/restore`, 'POST')
    expect(r.status).toBe(409)
    expect((await summaryGoal()).name).toBe('New')
  })

  it('404s for an unknown, active or other user’s goal', async () => {
    await setGoal('Mine', 10000)
    const activeId = (await call('/goal')).json.id
    expect((await call(`/goals/${activeId}/restore`, 'POST')).status).toBe(404)
    expect((await call('/goals/9999/restore', 'POST')).status).toBe(404)
    await call('/goal', 'DELETE')
    const id = (await call('/goals')).json[0].id
    expect((await call(`/goals/${id}/restore`, 'POST', undefined, 'b@x')).status).toBe(404)
  })

  it('removing twice is harmless', async () => {
    await setGoal('Trip', 10000)
    await call('/goal', 'DELETE')
    expect((await call('/goal', 'DELETE')).status).toBe(204)
    expect((await call('/goals')).json).toHaveLength(1)
  })
})

describe('history', () => {
  it('is newest first and per user', async () => {
    await setGoal('A', 100)
    await skip(100)
    await call('/goal/complete', 'POST')
    vi.setSystemTime(new Date('2026-10-20T12:00:00Z'))
    await setGoal('B', 100)
    await call('/goal', 'DELETE')
    expect((await call('/goals')).json.map((g: J) => g.name)).toEqual(['B', 'A'])
    expect((await call('/goals', 'GET', undefined, 'b@x')).json).toEqual([])
  })
})
