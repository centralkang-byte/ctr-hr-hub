'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 전년 대비(YoY) 변화 배지 (Phase 2-B1)
// ═══════════════════════════════════════════════════════════

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────

interface Props {
  current: number | null
  previous: number | null
  unit?: string
  /** true이면 감소가 긍정 (예: 이직률, 초과근무율) */
  invertColor?: boolean
  className?: string
}

// ─── Component ──────────────────────────────────────────────

export function YoYBadge({ current, previous, unit: _unit = '', invertColor = false, className }: Props) {
  if (current == null || previous == null || previous === 0) {
    return <span className={cn('text-xs text-muted-foreground', className)}>-</span>
  }

  const delta = current - previous
  const pct = Math.round((delta / Math.abs(previous)) * 100)

  if (pct === 0) {
    return (
      <span className={cn('inline-flex items-center gap-0.5 text-xs text-muted-foreground', className)}>
        <Minus className="h-3 w-3" />
        0%
      </span>
    )
  }

  const isUp = pct > 0
  // invertColor: 감소가 긍정인 경우 색상 반전
  const isPositive = invertColor ? !isUp : isUp

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-medium',
        isPositive ? 'text-emerald-600' : 'text-destructive',
        className,
      )}
    >
      {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {isUp ? '+' : ''}{pct}%
    </span>
  )
}
