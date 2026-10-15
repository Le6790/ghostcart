// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EntryForm } from './EntryForm.tsx'

const setup = (onSubmit = vi.fn().mockResolvedValue(undefined)) => {
  render(<EntryForm onSubmit={onSubmit} />)
  return { onSubmit, user: userEvent.setup() }
}

describe('EntryForm', () => {
  it('submits parsed cents and clears the fields', async () => {
    const { onSubmit, user } = setup()
    await user.type(screen.getByPlaceholderText('What did you skip?'), 'Sushi')
    await user.type(screen.getByPlaceholderText('Amount ($)'), '$45.50')
    await user.selectOptions(screen.getByRole('combobox'), 'travel')
    await user.type(screen.getByPlaceholderText('Note (optional)'), 'tempting')
    await user.click(screen.getByRole('button', { name: /didn't buy it/i }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Sushi', amountCents: 4550, category: 'travel', note: 'tempting' }),
    )
    expect(screen.getByPlaceholderText('What did you skip?')).toHaveValue('')
    expect(screen.getByPlaceholderText('Amount ($)')).toHaveValue('')
  })

  it('sends a null note when left blank', async () => {
    const { onSubmit, user } = setup()
    await user.type(screen.getByPlaceholderText('What did you skip?'), 'Hat')
    await user.type(screen.getByPlaceholderText('Amount ($)'), '10')
    await user.click(screen.getByRole('button', { name: /didn't buy it/i }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ note: null }))
  })

  it.each([
    ['missing title', '', '10'],
    ['invalid amount', 'Sushi', 'abc'],
    ['zero amount', 'Sushi', '0'],
  ])('shows an error and does not submit for %s', async (_n, title, amount) => {
    const { onSubmit, user } = setup()
    if (title) await user.type(screen.getByPlaceholderText('What did you skip?'), title)
    if (amount) await user.type(screen.getByPlaceholderText('Amount ($)'), amount)
    await user.click(screen.getByRole('button', { name: /didn't buy it/i }))
    expect(screen.getByText(/enter a title and a valid amount/i)).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('keeps input and shows the error when submit fails', async () => {
    const { user } = setup(vi.fn().mockRejectedValue(new Error('boom')))
    await user.type(screen.getByPlaceholderText('What did you skip?'), 'Sushi')
    await user.type(screen.getByPlaceholderText('Amount ($)'), '5')
    await user.click(screen.getByRole('button', { name: /didn't buy it/i }))
    expect(await screen.findByText('boom')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('What did you skip?')).toHaveValue('Sushi')
  })
})

describe('EntryForm cooldown', () => {
  it('parks the item as tempted with the chosen cooldown', async () => {
    const { onSubmit, user } = setup()
    await user.type(screen.getByPlaceholderText('What did you skip?'), 'Jacket')
    await user.type(screen.getByPlaceholderText('Amount ($)'), '120')
    const days = screen.getByLabelText('Cooldown days')
    await user.clear(days)
    await user.type(days, '14')
    await user.click(screen.getByRole('button', { name: 'Park it for 14 days' }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Jacket', amountCents: 12000, status: 'tempted', cooldownDays: 14 }),
    )
  })

  it('does not send status or cooldown for a normal skip', async () => {
    const { onSubmit, user } = setup()
    await user.type(screen.getByPlaceholderText('What did you skip?'), 'Hat')
    await user.type(screen.getByPlaceholderText('Amount ($)'), '10')
    await user.click(screen.getByRole('button', { name: /didn't buy it/i }))
    const sent = onSubmit.mock.calls[0][0]
    expect(sent).not.toHaveProperty('status')
    expect(sent).not.toHaveProperty('cooldownDays')
  })

  it('rejects an out-of-range cooldown', async () => {
    const { onSubmit, user } = setup()
    await user.type(screen.getByPlaceholderText('What did you skip?'), 'Hat')
    await user.type(screen.getByPlaceholderText('Amount ($)'), '10')
    const days = screen.getByLabelText('Cooldown days')
    await user.clear(days)
    await user.type(days, '120')
    await user.click(screen.getByRole('button', { name: /park it/i }))
    expect(screen.getByText(/cooldown must be 1 to 90/i)).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

describe('EntryForm park help', () => {
  const helpButton = () => screen.getByRole('button', { name: 'What does parking do?' })

  it('is hidden until the question mark is clicked, then toggles', async () => {
    const { user } = setup()
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    await user.click(helpButton())
    expect(screen.getByRole('tooltip')).toHaveTextContent(/won't count as savings until the cooldown ends/i)
    await user.click(helpButton())
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('closes on Escape and on an outside click', async () => {
    const { user } = setup()
    await user.click(helpButton())
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    await user.click(helpButton())
    await user.click(screen.getByPlaceholderText('Note (optional)'))
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('does not submit the form or park the item', async () => {
    const { onSubmit, user } = setup()
    await user.type(screen.getByPlaceholderText('What did you skip?'), 'Hat')
    await user.type(screen.getByPlaceholderText('Amount ($)'), '10')
    await user.click(helpButton())
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
