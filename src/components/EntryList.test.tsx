// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Entry } from '../../shared/schemas.ts'
import { EntryList } from './EntryList.tsx'

const entry = (over: Partial<Entry> = {}): Entry => ({
  id: 1,
  title: 'Sushi',
  amountCents: 4550,
  category: 'dining',
  note: null,
  skippedAt: '2026-10-01',
  status: 'skipped',
  decideBy: null,
  createdAt: '2026-10-01 12:00:00',
  ...over,
})

describe('EntryList', () => {
  it('shows an empty state', () => {
    render(<EntryList entries={[]} onDelete={() => {}} />)
    expect(screen.getByText('Nothing logged yet.')).toBeInTheDocument()
  })

  it('renders title, formatted amount, category, date and note', () => {
    render(<EntryList entries={[entry({ note: 'treat' })]} onDelete={() => {}} />)
    expect(screen.getByText('Sushi')).toBeInTheDocument()
    expect(screen.getByText('$45.50')).toBeInTheDocument()
    expect(screen.getByText('dining · 2026-10-01 · treat')).toBeInTheDocument()
  })

  it('calls onDelete with the entry id', async () => {
    const onDelete = vi.fn()
    render(<EntryList entries={[entry({ id: 1 }), entry({ id: 2, title: 'Shoes' })]} onDelete={onDelete} />)
    await userEvent.click(screen.getByRole('button', { name: 'Delete Shoes' }))
    expect(onDelete).toHaveBeenCalledWith(2)
  })

  it('offers to mark a skipped entry as bought and calls onToggleStatus', async () => {
    const onToggleStatus = vi.fn()
    const e = entry({ id: 3 })
    render(<EntryList entries={[e]} onDelete={() => {}} onToggleStatus={onToggleStatus} />)
    await userEvent.click(screen.getByRole('button', { name: 'I bought it' }))
    expect(onToggleStatus).toHaveBeenCalledWith(e)
  })

  it('shows Undo for a bought entry', () => {
    render(<EntryList entries={[entry({ status: 'bought' })]} onDelete={() => {}} onToggleStatus={() => {}} />)
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument()
  })

  it('opens an inline editor, saves a patch, and closes', async () => {
    const onEdit = vi.fn().mockResolvedValue(undefined)
    const e = entry({ id: 5 })
    render(<EntryList entries={[e]} onDelete={() => {}} onEdit={onEdit} />)
    await userEvent.click(screen.getByRole('button', { name: 'Edit Sushi' }))
    const title = screen.getByLabelText('Title')
    await userEvent.clear(title)
    await userEvent.type(title, 'Ramen')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onEdit).toHaveBeenCalledWith(e, expect.objectContaining({ title: 'Ramen', amountCents: 4550 }))
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument()
  })

  it('can cancel an edit without calling onEdit', async () => {
    const onEdit = vi.fn()
    render(<EntryList entries={[entry()]} onDelete={() => {}} onEdit={onEdit} />)
    await userEvent.click(screen.getByRole('button', { name: 'Edit Sushi' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onEdit).not.toHaveBeenCalled()
    expect(screen.getByText('Sushi')).toBeInTheDocument()
  })

  it('has no Edit button when onEdit is not provided', () => {
    render(<EntryList entries={[entry()]} onDelete={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Edit Sushi' })).not.toBeInTheDocument()
  })
})
