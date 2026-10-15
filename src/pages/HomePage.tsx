import { useCallback, useEffect, useState } from 'react'
import { formatCents } from '../../shared/money.ts'
import { CATEGORIES, type Entry, type Summary } from '../../shared/schemas.ts'
import { api } from '../api.ts'
import { EntryForm } from '../components/EntryForm.tsx'
import { EntryList } from '../components/EntryList.tsx'
import { TemptedList } from '../components/TemptedList.tsx'
import { UndoToast } from '../components/UndoToast.tsx'
import { GoalCard } from '../components/GoalCard.tsx'

export default function HomePage() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [category, setCategory] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [undo, setUndo] = useState<{ goalId: number; message: string } | null>(null)

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

  useEffect(() => { void refresh() }, [refresh])

  const tempted = entries.filter((e) => e.status === 'tempted')
  const history = entries.filter((e) => e.status !== 'tempted')

  const stat = (label: string, value: string) => (
    <div className="rounded-lg bg-white dark:bg-slate-900 p-4 shadow">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{value}</p>
    </div>
  )

  return (
    <div className="space-y-4">
      {error && <p className="rounded bg-red-50 dark:bg-red-950 p-3 text-red-700 dark:text-red-300">{error}</p>}
      {summary && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stat('Total saved', formatCents(summary.totalCents))}
          {stat('This month', formatCents(summary.monthCents))}
          {stat('Items skipped', String(summary.count))}
          {stat('Top category', summary.topCategory?.category ?? '—')}
        </section>
      )}
      {summary && summary.readyToDecide > 0 && (
        <p className="rounded bg-amber-50 dark:bg-amber-950 p-3 text-amber-800 dark:text-amber-200">
          {summary.readyToDecide} {summary.readyToDecide === 1 ? 'item is' : 'items are'} ready to decide.
        </p>
      )}
      <GoalCard
        goal={summary?.goal ?? null}
        onSave={async (name, targetCents) => { await api.setGoal({ name, targetCents }); await refresh() }}
        onClear={async () => {
          const g = summary?.goal
          await api.clearGoal()
          await refresh()
          if (g) setUndo({ goalId: g.id, message: `Goal "${g.name}" removed.` })
        }}
        onComplete={async () => {
          const done = await api.completeGoal()
          await refresh()
          setUndo({ goalId: done.id, message: `Goal "${done.name}" completed.` })
        }}
      />
      <EntryForm onSubmit={async (e) => { await api.addEntry(e); await refresh() }} />
      <TemptedList
        entries={tempted}
        today={summary?.today}
        onEdit={async (e, patch) => { await api.updateEntry(e.id, patch); await refresh() }}
        onResolve={async (e, status) => { await api.updateEntry(e.id, { status }); await refresh() }}
        onDelete={async (id) => { await api.deleteEntry(id); await refresh() }}
      />
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">History</h2>
        <select className="rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 px-2 py-1 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <EntryList
        entries={history}
        onEdit={async (e, patch) => { await api.updateEntry(e.id, patch); await refresh() }}
        onToggleStatus={async (e) => { await api.updateEntry(e.id, { status: e.status === 'skipped' ? 'bought' : 'skipped' }); await refresh() }}
        onDelete={async (id) => { await api.deleteEntry(id); await refresh() }} />
      {undo && (
        <UndoToast
          message={undo.message}
          onDismiss={() => setUndo(null)}
          onUndo={async () => {
            try {
              await api.restoreGoal(undo.goalId)
              setUndo(null)
              await refresh()
            } catch (err) {
              setUndo(null)
              setError(err instanceof Error ? err.message : 'Could not undo')
            }
          }}
        />
      )}
    </div>
  )
}
