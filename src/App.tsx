import { useCallback, useEffect, useState } from 'react'
import { formatCents } from '../shared/money.ts'
import { CATEGORIES, type Entry, type Me, type Summary } from '../shared/schemas.ts'
import { api } from './api.ts'
import { EntryForm } from './components/EntryForm.tsx'
import { EntryList } from './components/EntryList.tsx'
import { GoalCard } from './components/GoalCard.tsx'

export default function App() {
  const [me, setMe] = useState<Me | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [category, setCategory] = useState('')
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [s, e] = await Promise.all([api.summary(), api.entries({ category })])
      setSummary(s)
      setEntries(e)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    }
  }, [category])

  useEffect(() => { api.me().then(setMe).catch(() => {}) }, [])
  useEffect(() => { void refresh() }, [refresh])

  const stat = (label: string, value: string) => (
    <div className="rounded-lg bg-white p-4 shadow">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-emerald-700">{value}</p>
    </div>
  )

  return (
    <div className="mx-auto min-h-screen max-w-3xl space-y-4 bg-slate-50 p-4">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Ghost Cart</h1>
        {me && <span className="text-sm text-slate-500">{me.name}</span>}
      </header>
      {error && <p className="rounded bg-red-50 p-3 text-red-700">{error}</p>}
      {summary && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stat('Total saved', formatCents(summary.totalCents))}
          {stat('This month', formatCents(summary.monthCents))}
          {stat('Items skipped', String(summary.count))}
          {stat('Top category', summary.topCategory?.category ?? '—')}
        </section>
      )}
      <GoalCard
        goal={summary?.goal ?? null}
        onSave={async (name, targetCents) => { await api.setGoal({ name, targetCents }); await refresh() }}
        onClear={async () => { await api.clearGoal(); await refresh() }}
      />
      <EntryForm onSubmit={async (e) => { await api.addEntry(e); await refresh() }} />
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">History</h2>
        <select className="rounded border border-slate-300 px-2 py-1 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <EntryList entries={entries} onDelete={async (id) => { await api.deleteEntry(id); await refresh() }} />
    </div>
  )
}
