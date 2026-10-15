import { Hono } from 'hono'
import { entryInputSchema, entryPatchSchema, type Entry } from '../../shared/schemas.ts'
import type { AppEnv } from '../auth.ts'

interface Row {
  id: number
  title: string
  amount_cents: number
  category: Entry['category']
  note: string | null
  skipped_at: string
  status: Entry['status']
  created_at: string
}

const toEntry = (r: Row): Entry => ({
  id: r.id,
  title: r.title,
  amountCents: r.amount_cents,
  category: r.category,
  note: r.note,
  skippedAt: r.skipped_at,
  status: r.status,
  createdAt: r.created_at,
})

export const entries = new Hono<AppEnv>()

entries.get('/', (c) => {
  const { id } = c.get('user')
  const { category, from, to } = c.req.query()
  const where = ['user_id = ?']
  const args: (string | number)[] = [id]
  if (category) (where.push('category = ?'), args.push(category))
  if (from) (where.push('skipped_at >= ?'), args.push(from))
  if (to) (where.push('skipped_at <= ?'), args.push(to))
  const rows = c
    .get('db')
    .prepare(`SELECT * FROM entries WHERE ${where.join(' AND ')} ORDER BY skipped_at DESC, id DESC`)
    .all(...args) as Row[]
  return c.json(rows.map(toEntry))
})

entries.post('/', async (c) => {
  const parsed = entryInputSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400)
  const e = parsed.data
  const row = c
    .get('db')
    .prepare(
      `INSERT INTO entries (user_id, title, amount_cents, category, note, skipped_at)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
    )
    .get(c.get('user').id, e.title, e.amountCents, e.category, e.note ?? null, e.skippedAt) as Row
  return c.json(toEntry(row), 201)
})

entries.patch('/:id', async (c) => {
  const parsed = entryPatchSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400)
  const p = parsed.data
  const cols: Record<string, unknown> = {
    title: p.title,
    amount_cents: p.amountCents,
    category: p.category,
    note: p.note,
    skipped_at: p.skippedAt,
    status: p.status,
  }
  const sets = Object.keys(cols).filter((k) => cols[k] !== undefined)
  if (sets.length === 0) return c.json({ error: 'No fields to update' }, 400)
  const row = c
    .get('db')
    .prepare(
      `UPDATE entries SET ${sets.map((k) => `${k} = ?`).join(', ')}
       WHERE id = ? AND user_id = ? RETURNING *`,
    )
    .get(...sets.map((k) => cols[k]), Number(c.req.param('id')), c.get('user').id) as Row | undefined
  return row ? c.json(toEntry(row)) : c.json({ error: 'Not found' }, 404)
})

entries.delete('/:id', (c) => {
  const res = c
    .get('db')
    .prepare('DELETE FROM entries WHERE id = ? AND user_id = ?')
    .run(Number(c.req.param('id')), c.get('user').id)
  return res.changes ? c.body(null, 204) : c.json({ error: 'Not found' }, 404)
})
