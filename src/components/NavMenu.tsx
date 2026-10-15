import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useTheme } from '../theme.ts'

const ITEMS = [
  { to: '/', label: 'Home', end: true },
  { to: '/trends', label: 'Trends', end: false },
]

export function NavMenu({ onRefresh = () => window.location.reload() }: { onRefresh?: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const [theme, toggleTheme] = useTheme()
  const dark = theme === 'dark'

  // Close on Escape or a click outside the menu.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="flex h-10 w-10 flex-col items-center justify-center gap-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800"
        aria-label="Menu"
        aria-expanded={open}
        aria-controls="nav-menu"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="block h-0.5 w-5 bg-slate-700 dark:bg-slate-200" />
        <span className="block h-0.5 w-5 bg-slate-700 dark:bg-slate-200" />
        <span className="block h-0.5 w-5 bg-slate-700 dark:bg-slate-200" />
      </button>
      {open && (
        <nav id="nav-menu" aria-label="Main" className="absolute right-0 z-20 mt-2 w-40 rounded-lg bg-white dark:bg-slate-900 py-1 shadow-lg ring-1 ring-slate-200 dark:ring-slate-700">
          {ITEMS.map((i) => (
            <NavLink
              key={i.to}
              to={i.to}
              end={i.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `block px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 ${isActive ? 'font-semibold text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'}`
              }
            >
              {i.label}
            </NavLink>
          ))}
          {/* Home Screen web apps have no browser reload button, so offer one here. */}
          <button
            type="button"
            className="block w-full border-t border-slate-100 dark:border-slate-800 px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={onRefresh}
          >
            Refresh
          </button>
          <button
            type="button"
            role="switch"
            aria-checked={dark}
            className="flex w-full items-center justify-between border-t border-slate-100 dark:border-slate-800 px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={toggleTheme}
          >
            Dark mode
            <span aria-hidden="true" className={`relative h-5 w-9 rounded-full transition-colors ${dark ? 'bg-emerald-600' : 'bg-slate-300'}`}>
              <span
                className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${dark ? 'translate-x-4' : 'translate-x-0'}`}
              />
            </span>
          </button>
        </nav>
      )}
    </div>
  )
}
