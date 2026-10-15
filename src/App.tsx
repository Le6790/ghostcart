import { useEffect, useState } from 'react'
import { Link, Navigate, Route, Routes } from 'react-router-dom'
import type { Me } from '../shared/schemas.ts'
import { api } from './api.ts'
import { NavMenu } from './components/NavMenu.tsx'
import HomePage from './pages/HomePage.tsx'
import TrendsPage from './pages/TrendsPage.tsx'

export default function App() {
  const [me, setMe] = useState<Me | null>(null)
  useEffect(() => { api.me().then(setMe).catch(() => {}) }, [])

  return (
    <div className="mx-auto min-h-screen max-w-3xl space-y-4 bg-slate-50 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          <Link to="/" className="flex items-center gap-2">
            <img src="/ghostcart-logo.png" alt="" className="h-20 w-20 rounded-2xl" />
            Ghost Cart
          </Link>
        </h1>
        <div className="flex items-center gap-3">
          {me && <span className="text-sm text-slate-500">{me.name}</span>}
          <NavMenu />
        </div>
      </header>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/trends" element={<TrendsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
