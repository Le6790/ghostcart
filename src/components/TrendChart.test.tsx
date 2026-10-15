// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { TrendPoint } from '../../shared/schemas.ts'
import { TrendChart } from './TrendChart.tsx'

const months: TrendPoint[] = [
  { start: '2026-05-01', totalCents: 0 },
  { start: '2026-06-01', totalCents: 4500 },
  { start: '2026-07-01', totalCents: 12000 },
  { start: '2026-08-01', totalCents: 3000 },
  { start: '2026-09-01', totalCents: 0 },
  { start: '2026-10-01', totalCents: 8000 },
]

describe('TrendChart', () => {
  it('shows an empty state when nothing was saved', () => {
    render(<TrendChart points={months.map((p) => ({ ...p, totalCents: 0 }))} period="month" onPeriodChange={() => {}} />)
    expect(screen.getByText('Nothing saved in this period yet.')).toBeInTheDocument()
  })

  it('gives every column an accessible label with its exact value', () => {
    render(<TrendChart points={months} period="month" onPeriodChange={() => {}} />)
    expect(screen.getByRole('img', { name: 'July 2026: $120.00 saved' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'September 2026: $0.00 saved' })).toBeInTheDocument()
    expect(screen.getByText('Last 6 months')).toBeInTheDocument()
  })

  it('labels only the largest and the latest bar', () => {
    render(<TrendChart points={months} period="month" onPeriodChange={() => {}} />)
    // $120 is the max (also an axis tick candidate), $80 is the latest. $45 and $30 are not labelled.
    expect(screen.getAllByText('$120').length).toBeGreaterThan(0)
    expect(screen.getByText('$80')).toBeInTheDocument()
    expect(screen.queryByText('$45')).not.toBeInTheDocument()
    expect(screen.queryByText('$30')).not.toBeInTheDocument()
  })

  it('shows a tooltip on keyboard focus', async () => {
    render(<TrendChart points={months} period="month" onPeriodChange={() => {}} />)
    await userEvent.tab() // first control is the Monthly toggle
    const col = screen.getByRole('img', { name: 'June 2026: $45.00 saved' })
    col.focus()
    expect(await screen.findByRole('status')).toHaveTextContent('$45.00')
    expect(screen.getByRole('status')).toHaveTextContent('June 2026')
  })

  it('switches period', async () => {
    const onPeriodChange = vi.fn()
    render(<TrendChart points={months} period="month" onPeriodChange={onPeriodChange} />)
    expect(screen.getByRole('button', { name: 'Monthly' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Weekly' }))
    expect(onPeriodChange).toHaveBeenCalledWith('week')
  })

  it('labels weekly columns by week and can show a table view', async () => {
    const weeks: TrendPoint[] = [
      { start: '2026-10-05', totalCents: 1000 },
      { start: '2026-10-12', totalCents: 2500 },
    ]
    render(<TrendChart points={weeks} period="week" onPeriodChange={() => {}} />)
    expect(screen.getByText('Last 2 weeks')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Week of Oct 12: $25.00 saved' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Show table' }))
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('$25.00')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Show chart' }))
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
