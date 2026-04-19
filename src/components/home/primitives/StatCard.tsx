'use client'

import Link from 'next/link'
import { ArrowUpRight, TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ELEVATION, MOTION, TYPOGRAPHY, type StatusVariant } from '@/lib/styles'
import { Sparkline } from './Sparkline'

// ─── Types ──────────────────────────────────────────────────

interface TrendInfo {
  direction: 'up' | 'down' | 'flat'
  /** 사용자에게 노출될 짧은 문구 (예: "+12%" 또는 "-3건") */
  delta: string
  /** 스크린 리더용 완전한 문장 (예: "전월 대비 12% 증가") */
  sr: string
}

interface StatCardAction {
  label: string
  href: string
}

interface StatCardProps {
  /** 상단 라벨 (예: "승인 대기") */
  label: string
  /** 메인 수치 */
  value: string | number
  /** Trend 메타 (sparkline과 별개로 숫자 변화 설명) */
  trend?: TrendInfo
  /** 7-14 포인트 데이터 — Sparkline에 전달 */
  sparkline?: number[]
  /** 인라인 CTA (예: "모두 보기") */
  action?: StatCardAction
  /** 카드 톤 (semantic) — sparkline/trend 색상에도 반영 */
  tone?: 'default' | Extract<StatusVariant, 'success' | 'warning' | 'error' | 'info' | 'accent'>
  /** 로딩 스켈레톤 */
  loading?: boolean
  className?: string
}

// ─── Tone styles ────────────────────────────────────────────

const TONE_TEXT: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: 'text-foreground',
  success: 'text-[#15803d]',
  warning: 'text-ctr-warning',
  error: 'text-destructive',
  info: 'text-primary',
  accent: 'text-[#7c3aed]',
}

const TREND_ICON = { up: TrendingUp, down: TrendingDown, flat: Minus } as const

const TREND_COLOR = {
  up: 'text-[#15803d]',
  down: 'text-destructive',
  flat: 'text-muted-foreground',
} as const

// ─── Component ──────────────────────────────────────────────

/**
 * Linear-style metric card.
 * Label + big number + optional sparkline + trend chip + inline action.
 * Accessibility: section aria-labelledby pattern, trend has visually-hidden sr text,
 * 44px tap target on action, focus-visible ring.
 */
export function StatCard({
  label,
  value,
  trend,
  sparkline,
  action,
  tone = 'default',
  loading = false,
  className,
}: StatCardProps) {
  const labelId = `statcard-${label.replace(/\s+/g, '-')}`

  if (loading) {
    return (
      <div
        className={cn(
          'rounded-2xl bg-card p-5',
          ELEVATION.xs,
          'animate-pulse',
          className,
        )}
        aria-busy="true"
        aria-label={`${label} 로딩 중`}
      >
        <div className="h-3 w-20 rounded bg-muted" />
        <div className="mt-3 h-8 w-24 rounded bg-muted" />
        <div className="mt-4 h-5 w-16 rounded bg-muted" />
      </div>
    )
  }

  const TrendIcon = trend ? TREND_ICON[trend.direction] : null

  return (
    <section
      aria-labelledby={labelId}
      className={cn(
        'group relative flex flex-col rounded-2xl bg-card p-5',
        ELEVATION.xs,
        MOTION.hoverLift,
        className,
      )}
    >
      {/* Label */}
      <h3 id={labelId} className={TYPOGRAPHY.statLabel}>
        {label}
      </h3>

      {/* Value + Sparkline row */}
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className={cn(TYPOGRAPHY.displaySm, 'font-mono tabular-nums', TONE_TEXT[tone])}>
          {value}
        </p>
        {sparkline && sparkline.length > 0 ? (
          <Sparkline
            data={sparkline}
            className={cn('shrink-0', TONE_TEXT[tone])}
            ariaLabel={trend?.sr}
          />
        ) : null}
      </div>

      {/* Trend + Action row */}
      {(trend || action) ? (
        <div className="mt-3 flex items-center justify-between gap-3">
          {trend && TrendIcon ? (
            <span className={cn('inline-flex items-center gap-1 text-xs font-medium', TREND_COLOR[trend.direction])}>
              <TrendIcon className="h-3.5 w-3.5" aria-hidden="true" />
              <span aria-hidden="true">{trend.delta}</span>
              <span className="sr-only">{trend.sr}</span>
            </span>
          ) : <span />}
          {action ? (
            <Link
              href={action.href}
              className={cn(
                'inline-flex min-h-[44px] items-center gap-1 text-xs font-medium text-primary',
                'hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:rounded-sm',
                MOTION.microOut,
              )}
            >
              {action.label}
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
