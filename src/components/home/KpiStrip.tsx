'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — KPI Strip (2-tier)
// Hero KPI (큰 숫자) + Secondary KPIs (작은 카드).
// V3 Dashboard — Outfit display font (DESIGN.md §2).
// ═══════════════════════════════════════════════════════════

import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────

interface KpiItem {
  label: string
  value: string | number
  delta?: string
  deltaVariant?: 'good' | 'bad' | 'warn' | 'muted'
  /** 배경 강조. 'accent' = primary 배경+흰 텍스트, 'alert' = error 배경, 'warn' = warning 배경 */
  variant?: 'default' | 'accent' | 'alert' | 'warn'
  /** KPI value 하단에 표시할 badge (예: "High+Critical") */
  badge?: { text: string; variant: 'error' | 'warning' | 'info' }
}

interface KpiStripProps {
  /** Hero KPI (좌측 크게 표시). null이면 Hero 없이 균일 그리드. */
  hero?: KpiItem
  /** Secondary KPIs (우측 작은 카드 그리드) */
  items: KpiItem[]
  /** custom ReactNode를 hero 대신 사용 (예: 채용 파이프라인) */
  heroSlot?: React.ReactNode
  className?: string
}

// ─── Constants ──────────────────────────────────────────────

const CARD_BG: Record<NonNullable<KpiItem['variant']>, string> = {
  default: 'bg-card',
  accent: 'bg-primary text-white',
  alert: 'bg-error-container/20',
  warn: 'bg-[#FEF3C7]',
}

const DELTA_COLOR: Record<NonNullable<KpiItem['deltaVariant']>, string> = {
  good: 'text-tertiary',
  bad: 'text-error',
  warn: 'text-[#B45309]',
  muted: 'text-muted-foreground',
}

const BADGE_STYLES: Record<string, string> = {
  error: 'bg-error-container/20 text-error',
  warning: 'bg-[#FEF3C7] text-[#B45309]',
  info: 'bg-primary-container/20 text-primary',
}

// ─── Component ──────────────────────────────────────────────

export function KpiStrip({ hero, items, heroSlot, className }: KpiStripProps) {
  // hero를 items와 합쳐 균일 그리드로 렌더
  const allItems: KpiItem[] = hero ? [hero, ...items] : items
  const colCount = allItems.length

  return (
    <div className={cn('flex flex-wrap gap-3', className)}>
      {/* heroSlot이 있으면 첫 번째 슬롯으로 표시 */}
      {heroSlot && (
        <div
          className={cn(
            'rounded-2xl p-4 shadow-sm',
            hero ? CARD_BG[hero.variant ?? 'default'] : 'bg-card',
          )}
        >
          {heroSlot}
        </div>
      )}

      {/* 균일 그리드 */}
      <div
        className={cn(
          'grid flex-1 gap-3',
          colCount <= 2
            ? 'grid-cols-2'
            : colCount <= 3
              ? 'grid-cols-2 sm:grid-cols-3'
              : colCount <= 4
                ? 'grid-cols-2 sm:grid-cols-4'
                : 'grid-cols-2 sm:grid-cols-5',
        )}
      >
        {allItems.map((item, idx) => {
          const isHero = hero && idx === 0
          return (
          <div
            key={item.label}
            className={cn(
              'rounded-2xl p-4 shadow-sm',
              CARD_BG[item.variant ?? 'default'],
            )}
            aria-label={`${item.label}: ${item.value}`}
          >
            <p
              className={cn(
                'text-[10px] font-semibold uppercase tracking-[0.08em]',
                item.variant === 'accent'
                  ? 'text-white/70'
                  : 'text-muted-foreground',
              )}
              aria-hidden="true"
            >
              {item.label}
            </p>
            <p
              className={cn(
                'mt-1.5 font-display font-extrabold tabular-nums leading-tight tracking-tight',
                isHero ? 'text-4xl' : 'text-[32px]',
                item.variant === 'accent' ? 'text-white' : 'text-foreground',
              )}
              aria-hidden="true"
            >
              {item.value}
            </p>
            {item.badge && (
              <span
                className={cn(
                  'mt-1 inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold',
                  BADGE_STYLES[item.badge.variant],
                )}
              >
                {item.badge.text}
              </span>
            )}
            {item.delta && !item.badge && (
              <p
                className={cn(
                  'mt-1 text-[9px] font-medium',
                  item.variant === 'accent'
                    ? 'text-white/60'
                    : DELTA_COLOR[item.deltaVariant ?? 'muted'],
                )}
              >
                {item.delta}
              </p>
            )}
          </div>
          )
        })}
      </div>
    </div>
  )
}
