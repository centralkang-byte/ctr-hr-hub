'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Monitor Banner
// 전체폭 모니터링 배너. 큰 숫자 + 라벨 + 설명.
// HR Admin의 "매니저 승인 적체" 등 감시 지표용.
// ═══════════════════════════════════════════════════════════

import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────

interface MonitorBannerProps {
  label: string
  value: string | number
  description?: string
  /** 0이면 숨김 */
  hidden?: boolean
  className?: string
}

// ─── Component ──────────────────────────────────────────────

export function MonitorBanner({
  label,
  value,
  description,
  hidden,
  className,
}: MonitorBannerProps) {
  if (hidden) return null

  return (
    <div
      className={cn(
        'rounded-2xl bg-card p-5 shadow-sm',
        className,
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-display text-[42px] font-black leading-none text-foreground">
        {value}
      </p>
      {description && (
        <p className="mt-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
          {description}
        </p>
      )}
    </div>
  )
}
