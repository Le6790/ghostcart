// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Entry } from '../../shared/schemas.ts'
import { EntryEditor } from './EntryEditor.tsx'

const entry: Entry = {
  id: 1,
  title: 'Sushi',
  amountCents: 4550,
  category: 'dining',
  note: 'treat',
  skippedAt: '2026-10-01',
  status: 'skipped',
  decideBy: null,
  createdAt: '',
}

const setup = (onSave = vi.fn().mockResolvedValue(undefined)) => {
  const onCancel = vi.fn()
  render(<EntryEditor entry={entry} onSave={onSave} onCancel={onCancel} />)
  return { onSave, onCancel, user: userEvent.setup() }
}

describe('EntryEditor', () => {
  it('prefills from the entry', () => {
    setup()
    expect(screen.getByLabelText('Title')).toHaveValue('Sushi')
    expect(screen.getByLabelText('Amount')).toHaveValue('45.50')
    expect(screen.getByLabelText('Category')).toHaveValue('dining')
    expect(screen.getByLabelText('Date')).toHaveValue('2026-10-01')
    expect(screen.getByLabelText('Note')).toHaveValue('treat')
  })

  it('saves the changed fields as a patch', async () => {
    const { onSave, user } = setup()
    const title = screen.getByLabelText('Title')
    await user.clear(title)
    await user.type(title, 'Ramen')
    const amount = screen.getByLabelText('Amount')
    await user.clear(amount)
    await user.type(amount, '$12.25')
    await user.selectOptions(screen.getByLabelText('Category'), 'travel')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith({
      title: 'Ramen',
      amountCents: 1225,
      category: 'travel',
      skippedAt: '2026-10-01',
      note: 'treat',
    })
  })

  it('sends a null note when cleared', async () => {
    const { onSave, user } = setup()
    await user.clear(screen.getByLabelText('Note'))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ note: null }))
  })

  it.each([
    ['empty title', 'Title', ''],
    ['bad amount', 'Amount', 'abc'],
    ['zero amount', 'Amount', '0'],
  ])('does not save with %s', async (_n, label, value) => {
    const { onSave, user } = setup()
    const input = screen.getByLabelText(label)
    await user.clear(input)
    if (value) await user.type(input, value)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText(/enter a title and a valid amount/i)).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('shows the error and stays open when saving fails', async () => {
    const { user } = setup(vi.fn().mockRejectedValue(new Error('boom')))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('boom')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('cancels', async () => {
    const { onCancel, user } = setup()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalled()
  })
})
