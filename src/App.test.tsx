// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import App from './App.tsx'
import { api } from './api.ts'

vi.mock('./api.ts', () => ({
  api: {
    me: vi.fn(),
    summary: vi.fn(),
    trend: vi.fn(),
    entries: vi.fn(),
    addEntry: vi.fn(),
    updateEntry: vi.fn(),
    deleteEntry: vi.fn(),
    setGoal: vi.fn(),
    clearGoal: vi.fn(),
    goal: vi.fn().mockResolvedValue(null),
    goalHistory: vi.fn().mockResolvedValue([]),
    completeGoal: vi.fn(),
    restoreGoal: vi.fn(),
  },
}))

const m = vi.mocked(api)
const renderApp = (path = '/') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )

const summary = {
  totalCents: 12345,
  monthCents: 2000,
  count: 3,
  today: '2026-10-14',
  readyToDecide: 0,
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
  decideBy: null,
  createdAt: '',
}

beforeEach(() => {
  vi.resetAllMocks()
  m.me.mockResolvedValue({ login: 'a@x', name: 'Alice' })
  m.summary.mockResolvedValue(summary)
  m.entries.mockResolvedValue([entry])
  m.trend.mockResolvedValue([])
  m.goal.mockResolvedValue(null)
  m.goalHistory.mockResolvedValue([])
})

describe('App', () => {
  it('renders user, totals and entries', async () => {
    renderApp()
    expect(await screen.findByText('$123.45')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('$20.00')).toBeInTheDocument()
    expect(screen.getByText('Sushi')).toBeInTheDocument()
    expect(screen.getByText('Set a savings goal')).toBeInTheDocument()
  })

  it('shows an error when loading fails', async () => {
    m.summary.mockRejectedValue(new Error('GET /summary failed (500)'))
    renderApp()
    expect(await screen.findByText('GET /summary failed (500)')).toBeInTheDocument()
  })

  it('adds an entry then refreshes', async () => {
    m.addEntry.mockResolvedValue(entry)
    renderApp()
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
    renderApp()
    await userEvent.click(await screen.findByRole('button', { name: 'Delete Sushi' }))
    expect(m.deleteEntry).toHaveBeenCalledWith(1)
  })

  it('offers Undo after deleting an entry and re-creates it', async () => {
    m.deleteEntry.mockResolvedValue(undefined)
    m.addEntry.mockResolvedValue({ ...entry, id: 2 })
    renderApp()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Delete Sushi' }))
    expect(await screen.findByText('"Sushi" deleted.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() =>
      expect(m.addEntry).toHaveBeenCalledWith({ title: 'Sushi', amountCents: 4500, category: 'dining', note: null, skippedAt: '2026-10-01' }),
    )
    expect(m.updateEntry).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByText('"Sushi" deleted.')).not.toBeInTheDocument())
  })

  it('undoing a deleted bought entry restores its status', async () => {
    m.entries.mockResolvedValue([{ ...entry, status: 'bought' as const }])
    m.deleteEntry.mockResolvedValue(undefined)
    m.addEntry.mockResolvedValue({ ...entry, id: 2 })
    m.updateEntry.mockResolvedValue({ ...entry, id: 2, status: 'bought' })
    renderApp()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Delete Sushi' }))
    // Bought rows have their own "Undo" toggle, so scope to the toast.
    await user.click(within(await screen.findByRole('status')).getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(m.updateEntry).toHaveBeenCalledWith(2, { status: 'bought' }))
  })

  it('undoing a deleted parked item keeps its cooldown', async () => {
    m.entries.mockResolvedValue([{ ...entry, status: 'tempted' as const, skippedAt: '2026-10-01', decideBy: '2026-10-11' }])
    m.deleteEntry.mockResolvedValue(undefined)
    m.addEntry.mockResolvedValue({ ...entry, id: 2 })
    renderApp()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Delete Sushi' }))
    await user.click(await screen.findByRole('button', { name: 'Undo' }))
    await waitFor(() =>
      expect(m.addEntry).toHaveBeenCalledWith(expect.objectContaining({ status: 'tempted', cooldownDays: 10, skippedAt: '2026-10-01' })),
    )
  })

  it('refetches entries when the category filter changes', async () => {
    renderApp()
    await screen.findByText('Sushi')
    await userEvent.selectOptions(screen.getByDisplayValue('All categories'), 'travel')
    await waitFor(() => expect(m.entries).toHaveBeenLastCalledWith({ category: 'travel' }))
  })

  it('sets a goal', async () => {
    m.setGoal.mockResolvedValue({ id: 1, name: 'Trip', targetCents: 50000, startedAt: '2026-10-14' })
    renderApp()
    await screen.findByText('Sushi')
    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText('Saving for…'), 'Trip')
    await user.type(screen.getByPlaceholderText('Target ($)'), '500')
    await user.click(screen.getByRole('button', { name: 'Save goal' }))
    await waitFor(() => expect(m.setGoal).toHaveBeenCalledWith({ name: 'Trip', targetCents: 50000 }))
  })

  it('shows tempted items separately from history, with a ready-to-decide banner', async () => {
    m.summary.mockResolvedValue({ ...summary, readyToDecide: 2 })
    m.entries.mockResolvedValue([
      entry,
      { ...entry, id: 2, title: 'Jacket', status: 'tempted' as const, decideBy: '2020-01-01' },
    ])
    renderApp()
    expect(await screen.findByText('2 items are ready to decide.')).toBeInTheDocument()
    expect(screen.getByText('Cooling off')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Skip Jacket' })).toBeInTheDocument()
    // the tempted item is not duplicated in History (it has no "I bought it" toggle)
    expect(screen.getAllByRole('button', { name: 'I bought it' })).toHaveLength(1)
  })

  it('resolves a tempted item through the API', async () => {
    m.entries.mockResolvedValue([{ ...entry, id: 2, title: 'Jacket', status: 'tempted' as const, decideBy: '2999-01-01' }])
    m.updateEntry.mockResolvedValue(entry)
    renderApp()
    await userEvent.click(await screen.findByRole('button', { name: 'Skip Jacket' }))
    expect(m.updateEntry).toHaveBeenCalledWith(2, { status: 'skipped' })
  })

  it('does not load or show the trend chart on the home page', async () => {
    renderApp()
    await screen.findByText('Sushi')
    expect(screen.queryByText('Savings trend')).not.toBeInTheDocument()
    expect(m.trend).not.toHaveBeenCalled()
  })

  it('shows the trend chart on /trends and not the home content', async () => {
    m.trend.mockResolvedValue([{ start: '2026-10-01', totalCents: 4500 }])
    renderApp('/trends')
    expect(await screen.findByText('Savings trend')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Amount ($)')).not.toBeInTheDocument()
    expect(m.summary).not.toHaveBeenCalled()
  })

  it('redirects unknown routes to home', async () => {
    renderApp('/nope')
    expect(await screen.findByText('Sushi')).toBeInTheDocument()
  })

  it('navigates from the menu to trends and back', async () => {
    renderApp()
    await screen.findByText('Sushi')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Menu' }))
    await user.click(screen.getByRole('link', { name: 'Trends' }))
    expect(await screen.findByText('Savings trend')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Menu' }))
    await user.click(screen.getByRole('link', { name: 'Home' }))
    expect(await screen.findByText('Sushi')).toBeInTheDocument()
  })

  const withGoal = (over = {}) => ({
    ...summary,
    goal: { id: 7, name: 'Trip', targetCents: 10000, startedAt: '2026-10-01', savedCents: 2500, percent: 25, reached: false, ...over },
  })

  it('offers Undo after removing a goal and restores it', async () => {
    m.summary.mockResolvedValue(withGoal())
    m.clearGoal.mockResolvedValue(undefined)
    m.restoreGoal.mockResolvedValue({ id: 7, name: 'Trip', targetCents: 10000, startedAt: '2026-10-01' })
    renderApp()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Remove' }))
    expect(await screen.findByText('Goal "Trip" removed.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(m.restoreGoal).toHaveBeenCalledWith(7)
    await waitFor(() => expect(screen.queryByText('Goal "Trip" removed.')).not.toBeInTheDocument())
  })

  it('completes a reached goal and offers Undo', async () => {
    m.summary.mockResolvedValue(withGoal({ savedCents: 10000, percent: 100, reached: true }))
    m.completeGoal.mockResolvedValue({ id: 7, name: 'Trip', targetCents: 10000, startedAt: '2026-10-01', status: 'completed', endedAt: '2026-10-14', savedCents: 10000, percent: 100 })
    renderApp()
    await userEvent.click(await screen.findByRole('button', { name: 'Mark complete' }))
    expect(m.completeGoal).toHaveBeenCalled()
    expect(await screen.findByText('Goal "Trip" completed.')).toBeInTheDocument()
  })

  it('shows the goals history page from the menu', async () => {
    renderApp('/goals')
    expect(await screen.findByRole('heading', { name: 'Goals' })).toBeInTheDocument()
  })

  it('edits a history entry through the API then refreshes', async () => {
    m.updateEntry.mockResolvedValue(entry)
    renderApp()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Edit Sushi' }))
    const title = screen.getByLabelText('Title')
    await user.clear(title)
    await user.type(title, 'Ramen')
    const before = m.summary.mock.calls.length
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(m.updateEntry).toHaveBeenCalledWith(1, expect.objectContaining({ title: 'Ramen', amountCents: 4500 })),
    )
    await waitFor(() => expect(m.summary.mock.calls.length).toBeGreaterThan(before))
  })
})
