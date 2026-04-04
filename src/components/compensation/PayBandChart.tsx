'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Pay Band Chart
// 급여 밴드 내 현재 위치를 수평 바로 시각화
// ═══════════════════════════════════════════════════════════

import { useTranslations } from 'next-intl'
import { formatCurrency } from '@/lib/compensation'

// ─── Types ──────────────────────────────────────────────────

interface PayBandChartProps {
  currentSalary: number
  minSalary: number
  midSalary: number
  maxSalary: number
  currency?: string
  compact?: boolean
  /** 비교용 급여 (시뮬레이션 후 / merit 조정 후). 있으면 hollow dot으로 표시 */
  comparisonSalary?: number
}

// ─── Component ──────────────────────────────────────────────

export default function PayBandChart({
  currentSalary,
  minSalary,
  midSalary,
  maxSalary,
  compact = false,
  comparisonSalary,
}: PayBandChartProps) {
  const t = useTranslations('compensation')

  if (maxSalary <= minSalary || maxSalary <= 0) return null

  const range = maxSalary - minSalary
  const position = Math.max(0, Math.min(100, ((currentSalary - minSalary) / range) * 100))
  const midPosition = ((midSalary - minSalary) / range) * 100
  const comparisonPosition = comparisonSalary != null
    ? Math.max(0, Math.min(100, ((comparisonSalary - minSalary) / range) * 100))
    : null

  // Determine color based on salary position relative to band
  const getColor = (salary: number) => {
    if (salary < minSalary) return 'bg-destructive'
    if (salary > maxSalary) return 'bg-purple-500'
    if (salary < midSalary * 0.95) return 'bg-amber-500'
    if (salary > midSalary * 1.05) return 'bg-primary'
    return 'bg-emerald-500'
  }

  if (compact) {
    return (
      <div className="w-full" title={`${formatCurrency(currentSalary)} / ${formatCurrency(minSalary)}–${formatCurrency(maxSalary)}`}>
        <div className="relative h-2 bg-muted rounded-full overflow-visible">
          {/* Mid marker */}
          <div
            className="absolute top-0 h-2 w-px bg-muted-foreground/40"
            style={{ left: `${midPosition}%` }}
          />
          {/* Current position */}
          <div
            className={`absolute top-[-2px] h-[10px] w-[10px] rounded-full ${getColor(currentSalary)} ring-2 ring-white shadow-sm`}
            style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
          />
          {/* Comparison position (hollow dot) */}
          {comparisonPosition != null && comparisonSalary != null && (
            <div
              className={`absolute top-[-2px] h-[10px] w-[10px] rounded-full border-2 ${getColor(comparisonSalary).replace('bg-', 'border-')} bg-transparent`}
              style={{ left: `${comparisonPosition}%`, transform: 'translateX(-50%)' }}
              title={`${t('simulatedPosition')}: ${formatCurrency(comparisonSalary)}`}
            />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="relative h-3 bg-muted rounded-full overflow-visible">
        {/* Range fill */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-amber-500/20 via-emerald-500/20 to-primary/20" />
        {/* Mid marker */}
        <div
          className="absolute top-[-4px] h-[20px] w-px bg-muted-foreground/50"
          style={{ left: `${midPosition}%` }}
        />
        {/* Current position marker */}
        <div
          className={`absolute top-[-3px] h-[14px] w-[14px] rounded-full ${getColor(currentSalary)} ring-2 ring-white shadow-md`}
          style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
        />
        {/* Comparison position marker (hollow dot) */}
        {comparisonPosition != null && comparisonSalary != null && (
          <div
            className={`absolute top-[-3px] h-[14px] w-[14px] rounded-full border-2 ${getColor(comparisonSalary).replace('bg-', 'border-')} bg-transparent`}
            style={{ left: `${comparisonPosition}%`, transform: 'translateX(-50%)' }}
            title={`${t('simulatedPosition')}: ${formatCurrency(comparisonSalary)}`}
          />
        )}
      </div>
      {/* Labels */}
      <div className="flex justify-between text-[10px] text-muted-foreground font-mono tabular-nums">
        <span>{formatCurrency(minSalary)}</span>
        <span className="text-foreground font-medium">{t('currentSalary')}: {formatCurrency(currentSalary)}</span>
        <span>{formatCurrency(maxSalary)}</span>
      </div>
      {comparisonSalary != null && (
        <div className="text-[10px] text-muted-foreground font-mono tabular-nums text-center">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full border-2 border-current bg-transparent" />
            {t('simulatedPosition')}: {formatCurrency(comparisonSalary)}
          </span>
        </div>
      )}
    </div>
  )
}
