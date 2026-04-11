'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — D-day Pill
// 대시보드 task 항목의 D-day 시각 표현. DESIGN.md semantic colors.
// ═══════════════════════════════════════════════════════════

import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────

type DdayVariant = 'alert' | 'delay' | 'active'

interface DdayPillProps {
  /** D-day 값 (음수: 남은 일수, 양수: 초과일수, 0: 당일) */
  daysUntilDue: number
  className?: string
}

// ─── Constants ──────────────────────────────────────────────

// Phase 4 Batch 7 — D17/D18 색감: bg는 밝은 alert-red/warning-bright, text는 WCAG AA
const VARIANT_STYLES: Record<DdayVariant, { bg: string; text: string }> = {
  alert: { bg: 'bg-alert-red/10', text: 'text-error' },       // 긴급 D-3 이내
  delay: { bg: 'bg-warning-bright/15', text: 'text-[#B45309]' }, // 지연
  active: { bg: 'bg-primary-container/20', text: 'text-primary' }, // 여유
}

const VARIANT_LABELS: Record<DdayVariant, string> = {
  alert: 'ALERT',
  delay: 'DELAY',
  active: 'ACTIVE',
}

// ─── Helpers ────────────────────────────────────────────────

function resolveVariant(days: number): DdayVariant {
  if (days > 0) return 'delay'   // 초과 (마감 지남)
  if (days >= -3) return 'alert' // D-3 이내
  return 'active'                // 여유 있음
}

function formatDday(days: number): string {
  if (days === 0) return 'D-Day'
  if (days > 0) return `D+${days}`
  return `D${days}` // 음수이므로 D-5 형태
}

// ─── Component ──────────────────────────────────────────────

export function DdayPill({ daysUntilDue, className }: DdayPillProps) {
  const variant = resolveVariant(daysUntilDue)
  const styles = VARIANT_STYLES[variant]
  const label = VARIANT_LABELS[variant]

  return (
    <div
      className={cn(
        'flex h-[52px] w-[52px] flex-col items-center justify-center rounded-xl',
        styles.bg,
        className,
      )}
    >
      <span className={cn('text-sm font-extrabold leading-none', styles.text)}>
        {formatDday(daysUntilDue)}
      </span>
      <span
        className={cn(
          'mt-0.5 text-[8px] font-semibold uppercase tracking-wider',
          styles.text,
        )}
      >
        {label}
      </span>
    </div>
  )
}
