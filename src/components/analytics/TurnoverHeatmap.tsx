'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Turnover Heatmap (부서×월 이직률)
// CSS Grid + div 기반 — Phase 2-A 차트 다양성
// AD-2: 플랫 배열 HeatmapDataPoint[] 입력
// ═══════════════════════════════════════════════════════════

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { EmptyChart } from './EmptyChart'
import type { HeatmapDataPoint } from '@/lib/analytics/types'

// ─── Types ──────────────────────────────────────────────────

interface TurnoverHeatmapProps {
  data: HeatmapDataPoint[]
}

// ─── Helpers ────────────────────────────────────────────────

// 이직률 → 색상 클래스 (0% emerald → 5% amber → 10%+ red)
function getHeatColor(rate: number): string {
  if (rate === 0) return 'bg-emerald-500/15 dark:bg-emerald-900/30'
  if (rate < 2) return 'bg-emerald-200 dark:bg-emerald-800/40'
  if (rate < 4) return 'bg-amber-500/15 dark:bg-amber-900/30'
  if (rate < 6) return 'bg-amber-200 dark:bg-amber-800/40'
  if (rate < 8) return 'bg-orange-200 dark:bg-orange-800/40'
  if (rate < 10) return 'bg-red-200 dark:bg-red-800/40'
  return 'bg-red-400 dark:bg-red-700/60'
}

// ─── Component ──────────────────────────────────────────────

export function TurnoverHeatmap({ data }: TurnoverHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<{ dept: string; month: string } | null>(null)

  const { departments, months, cellMap } = useMemo(() => {
    if (!data || data.length === 0) return { departments: [], months: [], cellMap: new Map<string, HeatmapDataPoint>() }

    const deptSet = new Set<string>()
    const monthSet = new Set<string>()
    const map = new Map<string, HeatmapDataPoint>()

    for (const point of data) {
      deptSet.add(point.department)
      monthSet.add(point.month)
      map.set(`${point.department}-${point.month}`, point)
    }

    const sortedMonths = Array.from(monthSet).sort()
    const sortedDepts = Array.from(deptSet).sort()
    return { departments: sortedDepts, months: sortedMonths, cellMap: map }
  }, [data])

  if (departments.length === 0 || months.length === 0) return <EmptyChart />

  const hoveredPoint = hoveredCell ? cellMap.get(`${hoveredCell.dept}-${hoveredCell.month}`) : null

  return (
    <div className="relative">
      {/* 그리드 */}
      <div className="overflow-x-auto">
        <div
          className="grid gap-[2px] min-w-fit"
          style={{ gridTemplateColumns: `120px repeat(${months.length}, minmax(48px, 1fr))` }}
        >
          {/* 헤더: 월 */}
          <div className="text-xs text-muted-foreground font-medium p-1" />
          {months.map((m) => (
            <div key={m} className="text-xs text-muted-foreground text-center font-medium p-1 truncate">
              {m.split('-')[1]}월
            </div>
          ))}

          {/* 행: 부서별 */}
          {departments.map((dept) => (
            <div key={dept} className="contents">
              <div className="text-xs text-muted-foreground font-medium p-1 truncate flex items-center">
                {dept}
              </div>
              {months.map((month) => {
                const point = cellMap.get(`${dept}-${month}`)
                const rate = point?.turnoverRate ?? 0
                return (
                  <div
                    key={`${dept}-${month}`}
                    className={cn(
                      'h-8 rounded-sm transition-all cursor-default',
                      getHeatColor(rate),
                      hoveredCell?.dept === dept && hoveredCell?.month === month && 'ring-2 ring-primary',
                    )}
                    onMouseEnter={() => setHoveredCell({ dept, month })}
                    onMouseLeave={() => setHoveredCell(null)}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Tooltip */}
      {hoveredCell && hoveredPoint && (
        <div className="absolute top-2 right-2 bg-popover text-popover-foreground border rounded-lg shadow-lg px-3 py-2 text-xs z-10 pointer-events-none">
          <p className="font-semibold">{hoveredPoint.department}</p>
          <p className="text-muted-foreground">{hoveredPoint.month}</p>
          <p>이직률: <span className="font-medium">{hoveredPoint.turnoverRate}%</span></p>
          <p>인원: {hoveredPoint.headcount}명</p>
        </div>
      )}

      {/* 범례 */}
      <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
        <span>낮음</span>
        <div className="flex gap-0.5">
          {['bg-emerald-500/15', 'bg-emerald-200', 'bg-amber-500/15', 'bg-amber-200', 'bg-orange-200', 'bg-red-200', 'bg-red-400'].map((c) => (
            <div key={c} className={cn('w-5 h-3 rounded-sm', c)} />
          ))}
        </div>
        <span>높음</span>
      </div>
    </div>
  )
}
