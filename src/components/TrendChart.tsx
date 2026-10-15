import { useState } from 'react'
import { formatCents } from '../../shared/money.ts'
import type { TrendPeriod, TrendPoint } from '../../shared/schemas.ts'

// Chart geometry, in viewBox units (the SVG scales to its container).
const W = 360
const H = 210
const ML = 40
const MR = 8
const MT = 22
const MB = 28
const PLOT_W = W - ML - MR
const PLOT_H = H - MT - MB
const BASE = MT + PLOT_H
const MAX_BAR = 24
const RADIUS = 4

/** Clean axis ticks in dollars, from 0 up to the first step at or above the max. */
function niceTicks(maxCents: number): number[] {
  const maxD = Math.max(maxCents / 100, 1)
  const raw = maxD / 3
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = Math.max(1, ([1, 2, 5, 10].find((m) => m * mag >= raw) ?? 10) * mag)
  const ticks: number[] = []
  for (let v = 0; v <= Math.ceil(maxD / step) * step + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100)
  return ticks
}

const compact = (dollars: number) => (dollars >= 1000 ? `$${+(dollars / 1000).toFixed(1)}K` : `$${dollars}`)

const parse = (start: string) => new Date(`${start}T00:00:00Z`)
const fmt = (start: string, opts: Intl.DateTimeFormatOptions) =>
  parse(start).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' })

const axisLabel = (p: TrendPoint, period: TrendPeriod) =>
  period === 'month' ? fmt(p.start, { month: 'short' }) : fmt(p.start, { month: 'short', day: 'numeric' })

const fullLabel = (p: TrendPoint, period: TrendPeriod) =>
  period === 'month'
    ? fmt(p.start, { month: 'long', year: 'numeric' })
    : `Week of ${fmt(p.start, { month: 'short', day: 'numeric' })}`

/** Column with a rounded data-end and a square baseline. */
function barPath(x: number, w: number, top: number): string {
  const r = Math.min(RADIUS, BASE - top)
  return `M${x},${BASE} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${BASE} Z`
}

export function TrendChart({
  points,
  period,
  onPeriodChange,
}: {
  points: TrendPoint[]
  period: TrendPeriod
  onPeriodChange: (p: TrendPeriod) => void
}) {
  const [active, setActive] = useState<number | null>(null)
  const [table, setTable] = useState(false)

  const n = points.length
  const max = Math.max(0, ...points.map((p) => p.totalCents))
  const ticks = niceTicks(max)
  const top = ticks[ticks.length - 1] * 100
  const y = (cents: number) => BASE - (cents / top) * PLOT_H
  const band = n ? PLOT_W / n : PLOT_W
  const barW = Math.min(MAX_BAR, band * 0.6)
  const cx = (i: number) => ML + band * (i + 0.5)

  // Label sparingly: the biggest bar and the latest one. The axis and tooltip carry the rest.
  const labelled = new Set<number>()
  if (max > 0) {
    labelled.add(points.findIndex((p) => p.totalCents === max))
    if (points[n - 1].totalCents > 0) labelled.add(n - 1)
  }
  // Weekly labels are tight: show every other one, always including the latest.
  const showAxisLabel = (i: number) => period === 'month' || (n - 1 - i) % 2 === 0

  const unit = period === 'month' ? 'months' : 'weeks'
  const empty = max === 0
  const activePoint = active === null ? null : points[active]

  const toggle = (on: boolean) =>
    `rounded px-2 py-1 text-sm ${on ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`

  return (
    <section className="space-y-3 rounded-lg bg-white p-4 shadow">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">Savings trend</h2>
          <p className="text-sm text-slate-500">
            Last {n} {unit}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1" role="group" aria-label="Period">
            <button className={toggle(period === 'month')} aria-pressed={period === 'month'} onClick={() => onPeriodChange('month')}>
              Monthly
            </button>
            <button className={toggle(period === 'week')} aria-pressed={period === 'week'} onClick={() => onPeriodChange('week')}>
              Weekly
            </button>
          </div>
          <button className="text-sm text-slate-500 underline hover:text-slate-800" onClick={() => setTable((t) => !t)}>
            {table ? 'Show chart' : 'Show table'}
          </button>
        </div>
      </div>

      {empty ? (
        <p className="py-8 text-center text-slate-500">Nothing saved in this period yet.</p>
      ) : table ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-1 font-normal">{period === 'month' ? 'Month' : 'Week'}</th>
              <th className="py-1 text-right font-normal">Saved</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.start} className="border-t border-slate-100">
                <td className="py-1">{fullLabel(p, period)}</td>
                <td className="py-1 text-right tabular-nums">{formatCents(p.totalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="group" aria-label={`Money saved per ${period}`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={ML} x2={W - MR} y1={y(t * 100)} y2={y(t * 100)} className="stroke-slate-200" vectorEffect="non-scaling-stroke" />
                <text x={ML - 6} y={y(t * 100)} textAnchor="end" dominantBaseline="middle" fontSize={10} className="fill-slate-500">
                  {compact(t)}
                </text>
              </g>
            ))}
            {points.map((p, i) => {
              const barTop = y(p.totalCents)
              return (
                <g key={p.start}>
                  {p.totalCents > 0 && (
                    <path
                      d={barPath(cx(i) - barW / 2, barW, barTop)}
                      className={active === i ? 'fill-emerald-500' : 'fill-emerald-600'}
                    />
                  )}
                  {labelled.has(i) && (
                    <text x={cx(i)} y={barTop - 5} textAnchor="middle" fontSize={10} className="fill-slate-700">
                      {compact(Math.round(p.totalCents / 100))}
                    </text>
                  )}
                  {showAxisLabel(i) && (
                    <text x={cx(i)} y={BASE + 16} textAnchor="middle" fontSize={10} className="fill-slate-500">
                      {axisLabel(p, period)}
                    </text>
                  )}
                </g>
              )
            })}
            {/* Hit targets: the whole column band, not just the painted bar. */}
            {points.map((p, i) => (
              <rect
                key={p.start}
                x={ML + band * i}
                y={MT}
                width={band}
                height={PLOT_H + MB}
                fill="transparent"
                tabIndex={0}
                role="img"
                aria-label={`${fullLabel(p, period)}: ${formatCents(p.totalCents)} saved`}
                className="outline-none focus-visible:stroke-emerald-600"
                onPointerEnter={() => setActive(i)}
                onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
                onClick={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              />
            ))}
          </svg>
          {activePoint && active !== null && (
            <div
              role="status"
              className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg bg-slate-800 px-3 py-2 text-sm text-white shadow-lg"
              style={{ left: `clamp(56px, ${(cx(active) / W) * 100}%, calc(100% - 56px))` }}
            >
              <p className="font-semibold">{formatCents(activePoint.totalCents)}</p>
              <p className="text-slate-300">{fullLabel(activePoint, period)}</p>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
