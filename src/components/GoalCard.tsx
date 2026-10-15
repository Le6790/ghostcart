import { useState } from 'react'
import { formatCents, parseDollarsToCents } from '../../shared/money.ts'
import type { Summary } from '../../shared/schemas.ts'

interface Props {
  goal: Summary['goal']
  onSave: (name: string, targetCents: number) => Promise<void>
  onClear: () => Promise<void>
}

export function GoalCard({ goal, onSave, onClear }: Props) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')

  async function save(ev: React.FormEvent) {
    ev.preventDefault()
    const cents = parseDollarsToCents(target)
    if (!name.trim() || !cents) return
    await onSave(name, cents)
    setEditing(false)
  }

  if (!goal || editing) {
    return (
      <form onSubmit={save} className="flex flex-col gap-2 rounded-lg bg-white p-4 shadow">
        <h2 className="font-semibold">{goal ? 'Edit goal' : 'Set a savings goal'}</h2>
        <input className="rounded border border-slate-300 px-3 py-2" placeholder="Saving for…" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="rounded border border-slate-300 px-3 py-2" placeholder="Target ($)" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
        <div className="flex gap-2">
          <button className="rounded bg-emerald-600 px-3 py-2 text-white">Save goal</button>
          {goal && <button type="button" className="px-3 py-2 text-slate-600" onClick={() => setEditing(false)}>Cancel</button>}
        </div>
      </form>
    )
  }

  return (
    <div className="rounded-lg bg-white p-4 shadow">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">{goal.name}</h2>
        <span className="text-sm text-slate-600">
          {formatCents(goal.savedCents)} / {formatCents(goal.targetCents)}
        </span>
      </div>
      <div className="mt-3 h-3 overflow-hidden rounded bg-slate-200" role="progressbar" aria-valuenow={goal.percent} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full bg-emerald-500" style={{ width: `${goal.percent}%` }} />
      </div>
      <p className="mt-2 text-sm">{goal.reached ? '🎉 Goal reached!' : `${goal.percent}% there`}</p>
      <div className="mt-3 flex gap-3 text-sm">
        <button className="text-slate-600 underline" onClick={() => { setName(goal.name); setTarget(String(goal.targetCents / 100)); setEditing(true) }}>Edit</button>
        <button className="text-slate-600 underline" onClick={onClear}>Remove</button>
      </div>
    </div>
  )
}
