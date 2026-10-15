import { useEffect, useState } from 'react'
import { formatCents } from '../../shared/money.ts'
import type { Goal, GoalHistoryItem } from '../../shared/schemas.ts'
import { api } from '../api.ts'

export default function GoalsPage() {
  const [active, setActive] = useState<Goal | null>(null)
  const [history, setHistory] = useState<GoalHistoryItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Bumping `reload` re-runs the load effect (used after a restore).
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let current = true
    Promise.all([api.goal(), api.goalHistory()])
      .then(([a, h]) => {
        if (!current) return
        setActive(a)
        setHistory(h)
        setError(null)
      })
      .catch((err) => current && setError(err instanceof Error ? err.message : 'Failed to load'))
    return () => { current = false }
  }, [reload])

  async function restore(g: GoalHistoryItem) {
    try {
      await api.restoreGoal(g.id)
      setReload((n) => n + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not restore')
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Goals</h2>
      {error && <p className="rounded bg-red-50 dark:bg-red-950 p-3 text-red-700 dark:text-red-300">{error}</p>}
      {active && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Current goal: <span className="font-medium">{active.name}</span>. Finish or remove it on Home before restoring another.
        </p>
      )}
      {history && history.length === 0 && (
        <p className="text-slate-500 dark:text-slate-400">No past goals yet. Completed and removed goals appear here.</p>
      )}
      {history && history.length > 0 && (
        <ul className="divide-y divide-slate-200 dark:divide-slate-800 rounded-lg bg-white dark:bg-slate-900 shadow">
          {history.map((g) => (
            <li key={g.id} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {g.name}{' '}
                  <span
                    className={`ml-1 rounded px-1.5 py-0.5 text-xs ${
                      g.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {g.status === 'completed' ? 'Completed' : 'Removed'}
                  </span>
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {formatCents(g.savedCents)} of {formatCents(g.targetCents)} · {g.startedAt} to {g.endedAt}
                </p>
              </div>
              <button
                className="rounded border border-slate-300 dark:border-slate-600 px-2 py-1 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!!active}
                title={active ? 'Finish or remove your current goal first' : undefined}
                aria-label={`${g.status === 'completed' ? 'Reopen' : 'Restore'} ${g.name}`}
                onClick={() => restore(g)}
              >
                {g.status === 'completed' ? 'Reopen' : 'Restore'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
