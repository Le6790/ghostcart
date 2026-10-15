// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api.ts'
import TrendsPage from './TrendsPage.tsx'

vi.mock('../api.ts', () => ({ api: { trend: vi.fn() } }))
const m = vi.mocked(api)

beforeEach(() => {
  vi.resetAllMocks()
  m.trend.mockResolvedValue([
    { start: '2026-09-01', totalCents: 2000 },
    { start: '2026-10-01', totalCents: 4500 },
  ])
})

describe('TrendsPage', () => {
  it('loads the monthly trend and renders the chart', async () => {
    render(<TrendsPage />)
    expect(await screen.findByText('Last 2 months')).toBeInTheDocument()
    expect(m.trend).toHaveBeenCalledWith('month')
  })

  it('refetches when the period changes', async () => {
    render(<TrendsPage />)
    await screen.findByText('Last 2 months')
    await userEvent.click(screen.getByRole('button', { name: 'Weekly' }))
    await waitFor(() => expect(m.trend).toHaveBeenLastCalledWith('week'))
  })

  it('shows an error when loading fails', async () => {
    m.trend.mockRejectedValue(new Error('GET /trend?period=month failed (500)'))
    render(<TrendsPage />)
    expect(await screen.findByText('GET /trend?period=month failed (500)')).toBeInTheDocument()
  })
})
