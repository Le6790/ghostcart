// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { NavMenu } from './NavMenu.tsx'

const setup = (path = '/') => {
  render(
    <MemoryRouter initialEntries={[path]}>
      <NavMenu />
    </MemoryRouter>,
  )
  return { user: userEvent.setup(), button: screen.getByRole('button', { name: 'Menu' }) }
}

describe('NavMenu', () => {
  it('is closed by default and toggles from the hamburger button', async () => {
    const { user, button } = setup()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    expect(button).toHaveAttribute('aria-expanded', 'false')
    await user.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Trends' })).toHaveAttribute('href', '/trends')
    await user.click(button)
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('closes on Escape, outside click and after choosing a link', async () => {
    const { user, button } = setup()
    await user.click(button)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    await user.click(button)
    await user.click(document.body)
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    await user.click(button)
    await user.click(screen.getByRole('link', { name: 'Trends' }))
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('marks the current page', async () => {
    const { user, button } = setup('/trends')
    await user.click(button)
    expect(screen.getByRole('link', { name: 'Trends' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current')
  })
})
