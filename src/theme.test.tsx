// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveTheme, useTheme } from './theme.ts'

const stubSystem = (dark: boolean) =>
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: dark && q.includes('dark') }))

beforeEach(() => {
  localStorage.clear()
  document.documentElement.classList.remove('dark')
})
afterEach(() => vi.unstubAllGlobals())

describe('resolveTheme', () => {
  it('defaults to light when nothing is saved and matchMedia is unavailable', () => {
    expect(resolveTheme()).toBe('light')
  })

  it('follows the system setting when nothing is saved', () => {
    stubSystem(true)
    expect(resolveTheme()).toBe('dark')
    stubSystem(false)
    expect(resolveTheme()).toBe('light')
  })

  it('prefers a saved choice over the system setting', () => {
    stubSystem(true)
    localStorage.setItem('theme', 'light')
    expect(resolveTheme()).toBe('light')
  })

  it('ignores a junk saved value', () => {
    stubSystem(true)
    localStorage.setItem('theme', 'purple')
    expect(resolveTheme()).toBe('dark')
  })

  it('falls back when storage throws', () => {
    stubSystem(true)
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(resolveTheme()).toBe('dark')
    vi.restoreAllMocks()
  })
})

describe('useTheme', () => {
  it('applies the resolved theme to <html> without saving it', () => {
    stubSystem(true)
    renderHook(() => useTheme())
    expect(document.documentElement).toHaveClass('dark')
    expect(localStorage.getItem('theme')).toBeNull()
  })

  it('toggles the class and saves only on an explicit toggle', () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current[0]).toBe('light')
    act(() => result.current[1]())
    expect(result.current[0]).toBe('dark')
    expect(document.documentElement).toHaveClass('dark')
    expect(localStorage.getItem('theme')).toBe('dark')
    act(() => result.current[1]())
    expect(document.documentElement).not.toHaveClass('dark')
    expect(localStorage.getItem('theme')).toBe('light')
  })

  it('still toggles for the session when storage is unavailable', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    const { result } = renderHook(() => useTheme())
    act(() => result.current[1]())
    expect(result.current[0]).toBe('dark')
    expect(document.documentElement).toHaveClass('dark')
    vi.restoreAllMocks()
  })
})
