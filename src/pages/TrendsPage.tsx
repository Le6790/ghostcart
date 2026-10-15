import { useEffect, useState } from 'react'
import type { TrendPeriod, TrendPoint } from '../../shared/schemas.ts'
import { api } from '../api.ts'
import { TrendChart } from '../components/TrendChart.tsx'

export default function TrendsPage() {
  const [period, setPeriod] = useState<TrendPeriod>('month')
  const [points, setPoints] = useState<TrendPoint[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let current = true
    api
      .trend(period)
      .then((t) => {
        if (!current) return
        setPoints(t)
        setError(null)
      })
      .catch((err) => current && setError(err instanceof Error ? err.message : 'Failed to load'))
    return () => { current = false }
  }, [period])

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Trends</h2>
      {error && <p className="rounded bg-red-50 dark:bg-red-950 p-3 text-red-700 dark:text-red-300">{error}</p>}
      <TrendChart points={points} period={period} onPeriodChange={setPeriod} />
    </div>
  )
}
