import type { Entry, EntryInput, EntryPatch, Goal, GoalHistoryItem, GoalInput, Me, Summary, TrendPeriod, TrendPoint } from '../shared/schemas.ts'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'content-type': 'application/json' },
  })
  if (!res.ok) throw new Error(`${init?.method ?? 'GET'} ${path} failed (${res.status})`)
  return res.status === 204 ? (undefined as T) : res.json()
}

const body = (method: string, data: unknown): RequestInit => ({ method, body: JSON.stringify(data) })

export const api = {
  me: () => request<Me>('/me'),
  summary: () => request<Summary>('/summary'),
  trend: (period: TrendPeriod) => request<TrendPoint[]>(`/trend?period=${period}`),
  entries: (q: { category?: string; from?: string; to?: string } = {}) => {
    const qs = new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][])
    return request<Entry[]>(`/entries${qs.size ? `?${qs}` : ''}`)
  },
  addEntry: (e: EntryInput) => request<Entry>('/entries', body('POST', e)),
  updateEntry: (id: number, patch: EntryPatch) => request<Entry>(`/entries/${id}`, body('PATCH', patch)),
  deleteEntry: (id: number) => request<void>(`/entries/${id}`, { method: 'DELETE' }),
  goal: () => request<Goal | null>('/goal'),
  goalHistory: () => request<GoalHistoryItem[]>('/goals'),
  completeGoal: () => request<GoalHistoryItem>('/goal/complete', { method: 'POST' }),
  restoreGoal: (id: number) => request<Goal>(`/goals/${id}/restore`, { method: 'POST' }),
  setGoal: (g: GoalInput) => request<Goal>('/goal', body('PUT', g)),
  clearGoal: () => request<void>('/goal', { method: 'DELETE' }),
}
