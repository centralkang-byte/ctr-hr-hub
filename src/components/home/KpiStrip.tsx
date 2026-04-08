'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — KPI Strip (2-tier)
// Hero KPI (큰 숫자) + Secondary KPIs (작은 카드).
// DESIGN.md "Kinetic Atelier" — Editorial typography.
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
  const hasHero = hero || heroSlot

  return (
    <div className={cn('flex flex-wrap gap-3', className)}>
      {/* Hero KPI */}
      {hasHero && (
        <div
          className={cn(
            'w-full rounded-2xl p-5 shadow-sm sm:w-auto sm:flex-shrink-0',
            hero ? CARD_BG[hero.variant ?? 'default'] : 'bg-card',
          )}
          style={{ minWidth: 180 }}
        >
          {heroSlot ?? (
            hero && (
              <>
                <p
                  className={cn(
                    'text-[10px] font-semibold uppercase tracking-[0.08em]',
                    hero.variant === 'accent'
                      ? 'text-white/70'
                      : 'text-muted-foreground',
                  )}
                >
                  {hero.label}
                </p>
                <p
                  className={cn(
                    'mt-2 font-display text-4xl font-black leading-none',
                    hero.variant === 'accent' ? 'text-white' : 'text-foreground',
                  )}
                >
                  {hero.value}
                </p>
                {hero.delta && (
                  <p
                    className={cn(
                      'mt-1.5 text-[11px] font-medium',
                      hero.variant === 'accent'
                        ? 'text-white/60'
                        : DELTA_COLOR[hero.deltaVariant ?? 'muted'],
                    )}
                  >
                    {hero.delta}
                  </p>
                )}
              </>
            )
          )}
        </div>
      )}

      {/* Secondary Grid */}
      <div
        className={cn(
          'grid flex-1 gap-2',
          !hasHero && items.length <= 4
            ? 'grid-cols-2 sm:grid-cols-4'
            : items.length <= 3
              ? 'grid-cols-2 sm:grid-cols-3'
              : 'grid-cols-2 sm:grid-cols-4',
        )}
      >
        {items.map((item) => (
          <div
            key={item.label}
            className={cn(
              'rounded-2xl p-3 shadow-sm',
              CARD_BG[item.variant ?? 'default'],
            )}
          >
            <p
              className={cn(
                'text-[10px] font-semibold uppercase tracking-[0.08em]',
                item.variant === 'accent'
                  ? 'text-white/70'
                  : 'text-muted-foreground',
              )}
            >
              {item.label}
            </p>
            <p
              className={cn(
                'mt-1 font-mono text-lg font-extrabold tabular-nums leading-tight',
                item.variant === 'accent' ? 'text-white' : 'text-foreground',
              )}
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
        ))}
      </div>
    </div>
  )
}
