// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Summary } from '../../shared/schemas.ts'
import { GoalCard } from './GoalCard.tsx'

const goal = (over: Partial<NonNullable<Summary['goal']>> = {}): NonNullable<Summary['goal']> => ({
  name: 'Trip',
  targetCents: 100000,
  startedAt: '2026-10-01',
  savedCents: 25000,
  percent: 25,
  reached: false,
  ...over,
})

const noop = async () => {}

describe('GoalCard', () => {
  it('prompts to set a goal and saves it', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<GoalCard goal={null} onSave={onSave} onClear={noop} />)
    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText('Saving for…'), 'Japan')
    await user.type(screen.getByPlaceholderText('Target ($)'), '2,500')
    await user.click(screen.getByRole('button', { name: 'Save goal' }))
    expect(onSave).toHaveBeenCalledWith('Japan', 250000)
  })

  it('does not save with invalid input', async () => {
    const onSave = vi.fn()
    render(<GoalCard goal={null} onSave={onSave} onClear={noop} />)
    await userEvent.type(screen.getByPlaceholderText('Saving for…'), 'Japan')
    await userEvent.type(screen.getByPlaceholderText('Target ($)'), 'lots')
    await userEvent.click(screen.getByRole('button', { name: 'Save goal' }))
    expect(onSave).not.toHaveBeenCalled()
  })

  it('shows progress', () => {
    render(<GoalCard goal={goal()} onSave={noop} onClear={noop} />)
    expect(screen.getByText('Trip')).toBeInTheDocument()
    expect(screen.getByText('$250.00 / $1,000.00')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25')
    expect(screen.getByText('25% there')).toBeInTheDocument()
  })

  it('celebrates when reached', () => {
    render(<GoalCard goal={goal({ percent: 100, reached: true, savedCents: 100000 })} onSave={noop} onClear={noop} />)
    expect(screen.getByText(/goal reached/i)).toBeInTheDocument()
  })

  it('edits with prefilled values and can cancel', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<GoalCard goal={goal()} onSave={onSave} onClear={noop} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByPlaceholderText('Saving for…')).toHaveValue('Trip')
    expect(screen.getByPlaceholderText('Target ($)')).toHaveValue('1000')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByText('Trip')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('removes the goal', async () => {
    const onClear = vi.fn().mockResolvedValue(undefined)
    render(<GoalCard goal={goal()} onSave={noop} onClear={onClear} />)
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(onClear).toHaveBeenCalled()
  })
})
