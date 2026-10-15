import { formatCents } from '../../shared/money.ts'
import type { Entry } from '../../shared/schemas.ts'

export function EntryList({
  entries,
  onDelete,
  onToggleStatus,
}: {
  entries: Entry[]
  onDelete: (id: number) => void
  onToggleStatus?: (entry: Entry) => void
}) {
  if (entries.length === 0) return <p className="text-slate-500 dark:text-slate-400">Nothing logged yet.</p>
  return (
    <ul className="divide-y divide-slate-200 dark:divide-slate-800 rounded-lg bg-white dark:bg-slate-900 shadow">
      {entries.map((e) => (
        <li key={e.id} className={`flex items-center justify-between gap-3 p-3 ${e.status === 'bought' ? 'opacity-60' : ''}`}>
          <div className="min-w-0">
            <p className={`truncate font-medium ${e.status === 'bought' ? 'line-through' : ''}`}>{e.title}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {e.category} · {e.skippedAt}
              {e.note ? ` · ${e.note}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {onToggleStatus && (
              <button
                className="text-sm text-slate-500 dark:text-slate-400 underline hover:text-slate-800 dark:hover:text-slate-100"
                onClick={() => onToggleStatus(e)}
              >
                {e.status === 'skipped' ? 'I bought it' : 'Undo'}
              </button>
            )}
            <span className={`font-semibold ${e.status === 'bought' ? 'text-slate-500 dark:text-slate-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
              {formatCents(e.amountCents)}
            </span>
            <button className="text-sm text-slate-400 hover:text-red-600 dark:hover:text-red-400" aria-label={`Delete ${e.title}`} onClick={() => onDelete(e.id)}>✕</button>
          </div>
        </li>
      ))}
    </ul>
  )
}
