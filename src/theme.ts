import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const KEY = 'theme'

/** Saved choice if there is one, otherwise the system setting. Keep in sync with the script in index.html. */
export function resolveTheme(): Theme {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'dark' || saved === 'light') return saved
  } catch {
    // storage unavailable (private mode, etc.): fall through to the system setting
  }
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(resolveTheme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  const toggle = useCallback(() => {
    setTheme((t) => {
      const next: Theme = t === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem(KEY, next) // only an explicit choice is saved; until then we follow the system
      } catch {
        // not persisted; still applies for this session
      }
      return next
    })
  }, [])

  return [theme, toggle]
}
