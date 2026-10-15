import { formatCents } from '../../shared/money.ts'
import type { Entry } from '../../shared/schemas.ts'

const today = () => new Date().toISOString().slice(0, 10)

export function TemptedList({
  entries,
  onResolve,
  onDelete,
}: {
  entries: Entry[]
  onResolve: (entry: Entry, status: 'skipped' | 'bought') => void
  onDelete: (id: number) => void
}) {
  if (entries.length === 0) return null
  const now = today()
  const sorted = [...entries].sort((a, b) => (a.decideBy ?? '').localeCompare(b.decideBy ?? ''))
  return (
    <section className="space-y-2">
      <h2 className="font-semibold">Cooling off</h2>
      <ul className="divide-y divide-slate-200 dark:divide-slate-800 rounded-lg bg-white dark:bg-slate-900 shadow">
        {sorted.map((e) => {
          const ready = !!e.decideBy && e.decideBy <= now
          return (
            <li key={e.id} className={`flex items-center justify-between gap-3 p-3 ${ready ? 'bg-amber-50 dark:bg-amber-950' : ''}`}>
              <div className="min-w-0">
                <p className="truncate font-medium">{e.title}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {ready ? 'Ready to decide' : `Decide by ${e.decideBy}`} · {formatCents(e.amountCents)}
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <button
                  className="rounded bg-emerald-600 px-2 py-1 text-white hover:bg-emerald-700"
                  aria-label={`Skip ${e.title}`}
                  onClick={() => onResolve(e, 'skipped')}
                >
                  Skip it
                </button>
                <button
                  className="rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                  aria-label={`Bought ${e.title}`}
                  onClick={() => onResolve(e, 'bought')}
                >
                  Bought it
                </button>
                <button className="text-slate-400 hover:text-red-600 dark:hover:text-red-400" aria-label={`Delete ${e.title}`} onClick={() => onDelete(e.id)}>✕</button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
