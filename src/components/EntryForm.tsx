import { useState } from 'react'
import { parseDollarsToCents } from '../../shared/money.ts'
import { CATEGORIES, type Category, type EntryInput } from '../../shared/schemas.ts'

const today = () => new Date().toISOString().slice(0, 10)

export function EntryForm({ onSubmit }: { onSubmit: (e: EntryInput) => Promise<void> }) {
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<Category>('dining')
  const [skippedAt, setSkippedAt] = useState(today())
  const [note, setNote] = useState('')
  const [cooldown, setCooldown] = useState('30')
  const [error, setError] = useState<string | null>(null)

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

  const field = 'rounded border border-slate-300 px-3 py-2 w-full'
  return (
    <form onSubmit={submit} className="grid gap-3 rounded-lg bg-white p-4 shadow sm:grid-cols-2">
      <input className={field} placeholder="What did you skip?" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input className={field} placeholder="Amount ($)" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <select className={field} value={category} onChange={(e) => setCategory(e.target.value as Category)}>
        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <input className={field} type="date" value={skippedAt} onChange={(e) => setSkippedAt(e.target.value)} />
      <input className={`${field} sm:col-span-2`} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
      <button className="rounded bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700">
        I didn't buy it
      </button>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex-1 rounded border border-emerald-600 px-4 py-2 font-medium text-emerald-700 hover:bg-emerald-50"
          onClick={() => void send(true)}
        >
          Park it for {cooldown || '?'} days
        </button>
        <input
          className="w-20 rounded border border-slate-300 px-2 py-2"
          type="number"
          min={1}
          max={90}
          aria-label="Cooldown days"
          value={cooldown}
          onChange={(e) => setCooldown(e.target.value)}
        />
      </div>
    </form>
  )
}
