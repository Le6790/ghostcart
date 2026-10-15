// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NavMenu } from './NavMenu.tsx'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.classList.remove('dark')
})

const setup = (path = '/', onRefresh = vi.fn()) => {
  render(
    <MemoryRouter initialEntries={[path]}>
      <NavMenu onRefresh={onRefresh} />
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

  it('has a Refresh action that calls onRefresh', async () => {
    const onRefresh = vi.fn()
    const { user, button } = setup('/', onRefresh)
    await user.click(button)
    await user.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('has a dark mode switch that toggles the theme and remembers it', async () => {
    const { user, button } = setup()
    await user.click(button)
    const sw = screen.getByRole('switch', { name: 'Dark mode' })
    expect(sw).toHaveAttribute('aria-checked', 'false')
    await user.click(sw)
    expect(sw).toHaveAttribute('aria-checked', 'true')
    expect(document.documentElement).toHaveClass('dark')
    expect(localStorage.getItem('theme')).toBe('dark')
    await user.click(sw)
    expect(sw).toHaveAttribute('aria-checked', 'false')
    expect(document.documentElement).not.toHaveClass('dark')
  })

  it('starts on when dark was saved, and keeps the menu open after toggling', async () => {
    localStorage.setItem('theme', 'dark')
    const { user, button } = setup()
    await user.click(button)
    const sw = screen.getByRole('switch', { name: 'Dark mode' })
    expect(sw).toHaveAttribute('aria-checked', 'true')
    await user.click(sw)
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })
})
