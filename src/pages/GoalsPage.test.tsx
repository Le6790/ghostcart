// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GoalHistoryItem } from '../../shared/schemas.ts'
import { api } from '../api.ts'
import GoalsPage from './GoalsPage.tsx'

vi.mock('../api.ts', () => ({ api: { goal: vi.fn(), goalHistory: vi.fn(), restoreGoal: vi.fn() } }))
const m = vi.mocked(api)

const item = (over: Partial<GoalHistoryItem> = {}): GoalHistoryItem => ({
  id: 1,
  name: 'Japan',
  targetCents: 250000,
  startedAt: '2026-08-01',
  status: 'completed',
  endedAt: '2026-10-01',
  savedCents: 251000,
  percent: 100,
  ...over,
})

beforeEach(() => {
  vi.resetAllMocks()
  m.goal.mockResolvedValue(null)
  m.goalHistory.mockResolvedValue([item(), item({ id: 2, name: 'Bike', status: 'removed', savedCents: 4000, percent: 8 })])
})

describe('GoalsPage', () => {
  it('lists completed and removed goals with their numbers', async () => {
    render(<GoalsPage />)
    expect(await screen.findByText('Japan')).toBeInTheDocument()
    expect(screen.getByText('Completed')).toBeInTheDocument()
    expect(screen.getByText('Removed')).toBeInTheDocument()
    expect(screen.getByText('$2,510.00 of $2,500.00 · 2026-08-01 to 2026-10-01')).toBeInTheDocument()
  })

  it('shows an empty state', async () => {
    m.goalHistory.mockResolvedValue([])
    render(<GoalsPage />)
    expect(await screen.findByText(/No past goals yet/)).toBeInTheDocument()
  })

  it('reopens a completed goal and restores a removed one via the API, then reloads', async () => {
    m.restoreGoal.mockResolvedValue({ id: 1, name: 'Japan', targetCents: 250000, startedAt: '2026-08-01' })
    render(<GoalsPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Reopen Japan' }))
    expect(m.restoreGoal).toHaveBeenCalledWith(1)
    await waitFor(() => expect(m.goalHistory).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('button', { name: 'Restore Bike' })).toBeInTheDocument()
  })

  it('disables restore while a goal is active', async () => {
    m.goal.mockResolvedValue({ id: 9, name: 'Car', targetCents: 100, startedAt: '2026-10-10' })
    render(<GoalsPage />)
    const btn = await screen.findByRole('button', { name: 'Reopen Japan' })
    expect(btn).toBeDisabled()
    expect(screen.getByText(/Finish or remove it on Home/)).toBeInTheDocument()
  })

  it('shows an error when restore is refused', async () => {
    m.restoreGoal.mockRejectedValue(new Error('POST /goals/1/restore failed (409)'))
    render(<GoalsPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Reopen Japan' }))
    expect(await screen.findByText('POST /goals/1/restore failed (409)')).toBeInTheDocument()
  })
})
