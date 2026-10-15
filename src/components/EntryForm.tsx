import { useEffect, useRef, useState } from 'react'
import { localToday } from '../../shared/dates.ts'
import { parseDollarsToCents } from '../../shared/money.ts'
import { CATEGORIES, type Category, type EntryInput } from '../../shared/schemas.ts'


export function EntryForm({ onSubmit }: { onSubmit: (e: EntryInput) => Promise<void> }) {
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<Category>('dining')
  const [skippedAt, setSkippedAt] = useState(localToday())
  const [note, setNote] = useState('')
  const [cooldown, setCooldown] = useState('30')
  const [error, setError] = useState<string | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const helpRef = useRef<HTMLDivElement>(null)

  // Close the help bubble on Escape or a click outside it.
  useEffect(() => {
    if (!helpOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setHelpOpen(false)
    const onClick = (e: MouseEvent) => {
      if (!helpRef.current?.contains(e.target as Node)) setHelpOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [helpOpen])

  async function send(park: boolean) {
    const amountCents = parseDollarsToCents(amount)
    if (!title.trim() || !amountCents) return setError('Enter a title and a valid amount.')
    const days = Number(cooldown)
    if (park && !(Number.isInteger(days) && days >= 1 && days <= 90)) {
      return setError('Cooldown must be 1 to 90 days.')
    }
    setError(null)
    try {
      await onSubmit({
        title,
        amountCents,
        category,
        skippedAt,
        note: note || null,
        ...(park ? { status: 'tempted' as const, cooldownDays: days } : {}),
      })
      setTitle('')
      setAmount('')
      setNote('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    }
  }

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault()
    return send(false)
  }

  const field = 'rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 px-3 py-2 w-full min-w-0'
  return (
    <form onSubmit={submit} className="grid gap-3 rounded-lg bg-white dark:bg-slate-900 p-4 shadow sm:grid-cols-2">
      <input className={field} placeholder="What did you skip?" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input className={field} placeholder="Amount ($)" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <select className={field} value={category} onChange={(e) => setCategory(e.target.value as Category)}>
        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <input className={`${field} appearance-none text-left`} type="date" value={skippedAt} onChange={(e) => setSkippedAt(e.target.value)} />
      <input className={`${field} sm:col-span-2`} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      {error && <p className="text-sm text-red-600 dark:text-red-400 sm:col-span-2">{error}</p>}
      <div className="grid gap-3 sm:col-span-2">
        <button className="rounded bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700">
          I didn't buy it
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex-1 rounded border border-emerald-600 px-4 py-2 font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950"
            onClick={() => void send(true)}
          >
            Park it for {cooldown || '?'} days
          </button>
          <div ref={helpRef} className="relative">
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-400 dark:border-slate-500 text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="What does parking do?"
              aria-expanded={helpOpen}
              aria-controls="park-help"
              onClick={() => setHelpOpen((o) => !o)}
            >
              ?
            </button>
            {helpOpen && (
              <div
                id="park-help"
                role="tooltip"
                className="absolute bottom-full right-0 z-10 mb-2 w-64 rounded-lg bg-slate-800 dark:bg-slate-700 p-3 text-sm text-white shadow-lg"
              >
                Not sure yet? Park the item instead of logging it as skipped. It won't count as savings until the
                cooldown ends, then you decide: still want it, or let it go.
              </div>
            )}
          </div>
          <input
            className="w-20 rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 px-2 py-2"
            type="number"
            min={1}
            max={90}
            aria-label="Cooldown days"
            value={cooldown}
            onChange={(e) => setCooldown(e.target.value)}
          />
        </div>
      </div>
    </form>
  )
}
