import { useCallback, useEffect, useState } from 'react'
import { formatCents } from '../shared/money.ts'
import { CATEGORIES, type Entry, type Me, type Summary } from '../shared/schemas.ts'
import { api } from './api.ts'
import { EntryForm } from './components/EntryForm.tsx'
import { EntryList } from './components/EntryList.tsx'
import { TemptedList } from './components/TemptedList.tsx'
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

  const tempted = entries.filter((e) => e.status === 'tempted')
  const history = entries.filter((e) => e.status !== 'tempted')

  const stat = (label: string, value: string) => (
    <div className="rounded-lg bg-white p-4 shadow">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-emerald-700">{value}</p>
    </div>
  )

  return (
    <div className="mx-auto min-h-screen max-w-3xl space-y-4 bg-slate-50 p-4">
      <header className="flex items-baseline justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <img src="/ghostcart-logo.png" alt="" className="h-20 w-20 rounded-2xl" />
          Ghost Cart
        </h1>
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
      {summary && summary.readyToDecide > 0 && (
        <p className="rounded bg-amber-50 p-3 text-amber-800">
          {summary.readyToDecide} {summary.readyToDecide === 1 ? 'item is' : 'items are'} ready to decide.
        </p>
      )}
      <GoalCard
        goal={summary?.goal ?? null}
        onSave={async (name, targetCents) => { await api.setGoal({ name, targetCents }); await refresh() }}
        onClear={async () => { await api.clearGoal(); await refresh() }}
      />
      <EntryForm onSubmit={async (e) => { await api.addEntry(e); await refresh() }} />
      <TemptedList
        entries={tempted}
        onResolve={async (e, status) => { await api.updateEntry(e.id, { status }); await refresh() }}
        onDelete={async (id) => { await api.deleteEntry(id); await refresh() }}
      />
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">History</h2>
        <select className="rounded border border-slate-300 px-2 py-1 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <EntryList
        entries={history}
        onToggleStatus={async (e) => { await api.updateEntry(e.id, { status: e.status === 'skipped' ? 'bought' : 'skipped' }); await refresh() }}
        onDelete={async (id) => { await api.deleteEntry(id); await refresh() }} />
    </div>
  )
}
