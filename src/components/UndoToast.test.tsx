// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UndoToast } from './UndoToast.tsx'

afterEach(() => vi.useRealTimers())

describe('UndoToast', () => {
  it('shows the message and calls onUndo', async () => {
    const onUndo = vi.fn()
    render(<UndoToast message='Goal "Trip" removed.' onUndo={onUndo} onDismiss={() => {}} />)
    expect(screen.getByRole('status')).toHaveTextContent('Goal "Trip" removed.')
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(onUndo).toHaveBeenCalled()
  })

  it('can be dismissed', async () => {
    const onDismiss = vi.fn()
    render(<UndoToast message="x" onUndo={() => {}} onDismiss={onDismiss} />)
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(onDismiss).toHaveBeenCalled()
  })

  it('dismisses itself after the duration', () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()
    render(<UndoToast message="x" onUndo={() => {}} onDismiss={onDismiss} durationMs={5000} />)
    act(() => vi.advanceTimersByTime(4999))
    expect(onDismiss).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
