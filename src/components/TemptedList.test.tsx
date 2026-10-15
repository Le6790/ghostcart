// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Entry } from '../../shared/schemas.ts'
import { TemptedList } from './TemptedList.tsx'

const entry = (over: Partial<Entry> = {}): Entry => ({
  id: 1,
  title: 'Jacket',
  amountCents: 12000,
  category: 'shopping',
  note: null,
  skippedAt: '2026-10-01',
  status: 'tempted',
  decideBy: '2999-01-01',
  createdAt: '',
  ...over,
})

describe('TemptedList', () => {
  it('renders nothing when empty', () => {
    const { container } = render(<TemptedList entries={[]} onResolve={() => {}} onDelete={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the decide-by date while cooling off', () => {
    render(<TemptedList entries={[entry()]} onResolve={() => {}} onDelete={() => {}} />)
    expect(screen.getByText(/Decide by 2999-01-01/)).toBeInTheDocument()
  })

  it('flags entries whose cooldown has ended', () => {
    render(<TemptedList entries={[entry({ decideBy: '2020-01-01' })]} onResolve={() => {}} onDelete={() => {}} />)
    expect(screen.getByText(/Ready to decide/)).toBeInTheDocument()
  })

  it('resolves as skipped or bought and can delete', async () => {
    const onResolve = vi.fn()
    const onDelete = vi.fn()
    const e = entry()
    render(<TemptedList entries={[e]} onResolve={onResolve} onDelete={onDelete} />)
    await userEvent.click(screen.getByRole('button', { name: 'Skip Jacket' }))
    expect(onResolve).toHaveBeenCalledWith(e, 'skipped')
    await userEvent.click(screen.getByRole('button', { name: 'Bought Jacket' }))
    expect(onResolve).toHaveBeenCalledWith(e, 'bought')
    await userEvent.click(screen.getByRole('button', { name: 'Delete Jacket' }))
    expect(onDelete).toHaveBeenCalledWith(1)
  })

  it('uses the supplied today so "ready" agrees with the server', () => {
    render(<TemptedList entries={[entry({ decideBy: '2026-10-14' })]} today="2026-10-14" onResolve={() => {}} onDelete={() => {}} />)
    expect(screen.getByText(/Ready to decide/)).toBeInTheDocument()
    render(<TemptedList entries={[entry({ id: 2, decideBy: '2026-10-14' })]} today="2026-10-13" onResolve={() => {}} onDelete={() => {}} />)
    expect(screen.getByText(/Decide by 2026-10-14/)).toBeInTheDocument()
  })

  it('edits a parked item inline', async () => {
    const onEdit = vi.fn().mockResolvedValue(undefined)
    const e = entry()
    render(<TemptedList entries={[e]} onResolve={() => {}} onDelete={() => {}} onEdit={onEdit} />)
    await userEvent.click(screen.getByRole('button', { name: 'Edit Jacket' }))
    const amount = screen.getByLabelText('Amount')
    await userEvent.clear(amount)
    await userEvent.type(amount, '99')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onEdit).toHaveBeenCalledWith(e, expect.objectContaining({ amountCents: 9900 }))
  })
})
