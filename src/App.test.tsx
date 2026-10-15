// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.tsx'
import { api } from './api.ts'

vi.mock('./api.ts', () => ({
  api: {
    me: vi.fn(),
    summary: vi.fn(),
    entries: vi.fn(),
    addEntry: vi.fn(),
    deleteEntry: vi.fn(),
    setGoal: vi.fn(),
    clearGoal: vi.fn(),
  },
}))

const m = vi.mocked(api)

const summary = {
  totalCents: 12345,
  monthCents: 2000,
  count: 3,
  topCategory: { category: 'dining' as const, cents: 9000 },
  goal: null,
}
const entry = {
  id: 1,
  title: 'Sushi',
  amountCents: 4500,
  category: 'dining' as const,
  note: null,
  skippedAt: '2026-10-01',
  status: 'skipped' as const,
  createdAt: '',
}

beforeEach(() => {
  vi.resetAllMocks()
  m.me.mockResolvedValue({ login: 'a@x', name: 'Alice' })
  m.summary.mockResolvedValue(summary)
  m.entries.mockResolvedValue([entry])
})

describe('App', () => {
  it('renders user, totals and entries', async () => {
    render(<App />)
    expect(await screen.findByText('$123.45')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('$20.00')).toBeInTheDocument()
    expect(screen.getByText('Sushi')).toBeInTheDocument()
    expect(screen.getByText('Set a savings goal')).toBeInTheDocument()
  })

  it('shows an error when loading fails', async () => {
    m.summary.mockRejectedValue(new Error('GET /summary failed (500)'))
    render(<App />)
    expect(await screen.findByText('GET /summary failed (500)')).toBeInTheDocument()
  })

  it('adds an entry then refreshes', async () => {
    m.addEntry.mockResolvedValue(entry)
    render(<App />)
    await screen.findByText('Sushi')
    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText('What did you skip?'), 'Coffee')
    await user.type(screen.getByPlaceholderText('Amount ($)'), '4')
    const before = m.summary.mock.calls.length
    await user.click(screen.getByRole('button', { name: /didn't buy it/i }))
    await waitFor(() => expect(m.addEntry).toHaveBeenCalledWith(expect.objectContaining({ title: 'Coffee', amountCents: 400 })))
    await waitFor(() => expect(m.summary.mock.calls.length).toBeGreaterThan(before))
  })

  it('deletes an entry', async () => {
    m.deleteEntry.mockResolvedValue(undefined)
    render(<App />)
    await userEvent.click(await screen.findByRole('button', { name: 'Delete Sushi' }))
    expect(m.deleteEntry).toHaveBeenCalledWith(1)
  })

  it('refetches entries when the category filter changes', async () => {
    render(<App />)
    await screen.findByText('Sushi')
    await userEvent.selectOptions(screen.getByDisplayValue('All categories'), 'travel')
    await waitFor(() => expect(m.entries).toHaveBeenLastCalledWith({ category: 'travel' }))
  })

  it('sets a goal', async () => {
    m.setGoal.mockResolvedValue({ name: 'Trip', targetCents: 50000, startedAt: '2026-10-14' })
    render(<App />)
    await screen.findByText('Sushi')
    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText('Saving for…'), 'Trip')
    await user.type(screen.getByPlaceholderText('Target ($)'), '500')
    await user.click(screen.getByRole('button', { name: 'Save goal' }))
    await waitFor(() => expect(m.setGoal).toHaveBeenCalledWith({ name: 'Trip', targetCents: 50000 }))
  })
})
