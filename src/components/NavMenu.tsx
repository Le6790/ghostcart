import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'

const ITEMS = [
  { to: '/', label: 'Home', end: true },
  { to: '/trends', label: 'Trends', end: false },
]

export function NavMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

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
        className="flex h-10 w-10 flex-col items-center justify-center gap-1 rounded hover:bg-slate-200"
        aria-label="Menu"
        aria-expanded={open}
        aria-controls="nav-menu"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="block h-0.5 w-5 bg-slate-700" />
        <span className="block h-0.5 w-5 bg-slate-700" />
        <span className="block h-0.5 w-5 bg-slate-700" />
      </button>
      {open && (
        <nav id="nav-menu" aria-label="Main" className="absolute right-0 z-20 mt-2 w-40 rounded-lg bg-white py-1 shadow-lg ring-1 ring-slate-200">
          {ITEMS.map((i) => (
            <NavLink
              key={i.to}
              to={i.to}
              end={i.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `block px-4 py-2 text-sm hover:bg-slate-100 ${isActive ? 'font-semibold text-emerald-700' : 'text-slate-700'}`
              }
            >
              {i.label}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  )
}
