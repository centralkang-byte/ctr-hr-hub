'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 백분위 인디케이터 바 (Phase 2-B1)
// 수평 바 위에 마커로 법인 위치 표시
// ═══════════════════════════════════════════════════════════

import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────

interface Props {
  percentile: number | null
  className?: string
}

// ─── Helpers ────────────────────────────────────────────────

function getColor(p: number): string {
  if (p >= 75) return 'bg-emerald-500'
  if (p >= 25) return 'bg-amber-500'
  return 'bg-destructive/50'
}

// ─── Component ──────────────────────────────────────────────

export function PercentileBar({ percentile, className }: Props) {
  if (percentile == null) {
    return <span className="text-xs text-muted-foreground">-</span>
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* 바 */}
      <div className="relative w-20 h-1.5 bg-muted rounded-full">
        <div
          className={cn('absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-card shadow-sm', getColor(percentile))}
          style={{ left: `${Math.min(Math.max(percentile, 2), 98)}%`, transform: 'translate(-50%, -50%)' }}
        />
      </div>
      {/* 수치 */}
      <span className="text-xs font-mono text-muted-foreground w-8 text-right">
        P{percentile}
      </span>
    </div>
  )
}
