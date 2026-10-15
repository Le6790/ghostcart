import { useState } from 'react'
import { parseDollarsToCents } from '../../shared/money.ts'
import { CATEGORIES, type Category, type Entry, type EntryPatch } from '../../shared/schemas.ts'

/** Inline editor for an entry's own fields (not its status or cooldown). */
export function EntryEditor({
  entry,
  onSave,
  onCancel,
}: {
  entry: Entry
  onSave: (patch: EntryPatch) => Promise<void>
  onCancel: () => void
}) {
  const [title, setTitle] = useState(entry.title)
  const [amount, setAmount] = useState((entry.amountCents / 100).toFixed(2))
  const [category, setCategory] = useState<Category>(entry.category)
  const [skippedAt, setSkippedAt] = useState(entry.skippedAt)
  const [note, setNote] = useState(entry.note ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function save(ev: React.FormEvent) {
    ev.preventDefault()
    const amountCents = parseDollarsToCents(amount)
    if (!title.trim() || !amountCents) return setError('Enter a title and a valid amount.')
    setError(null)
    setSaving(true)
    try {
      await onSave({ title, amountCents, category, skippedAt, note: note.trim() || null })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
      setSaving(false)
    }
  }

  const field = 'rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 px-2 py-1.5 w-full min-w-0 text-sm'
  return (
    <form onSubmit={save} className="grid w-full gap-2 sm:grid-cols-2" aria-label={`Edit ${entry.title}`}>
      <input className={field} aria-label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input className={field} aria-label="Amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <select className={field} aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <input className={`${field} appearance-none text-left`} aria-label="Date" type="date" value={skippedAt} onChange={(e) => setSkippedAt(e.target.value)} />
      <input className={`${field} sm:col-span-2`} aria-label="Note" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      {error && <p className="text-sm text-red-600 dark:text-red-400 sm:col-span-2">{error}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <button disabled={saving} className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
          Save
        </button>
        <button type="button" className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
