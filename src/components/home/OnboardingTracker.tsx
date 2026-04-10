'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Onboarding Tracker
// Phase 4 Batch 7 — dashboard V3 2-Zone. 3개 variant 지원:
//   - admin:    최대 3명 리스트 (HR Admin Monitor Zone)
//   - team:     1명 강조 카드 (Manager Monitor Zone, 조건부)
//   - personal: 원형 진행률 (Employee Action Zone 최상단)
// ═══════════════════════════════════════════════════════════

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { UserPlus } from 'lucide-react'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { WidgetSkeleton } from '@/components/shared/WidgetSkeleton'
import { TYPOGRAPHY } from '@/lib/styles'
import { cn } from '@/lib/utils'
import type { OnboardingItem } from '@/types'

// ─── Types ──────────────────────────────────────────────────

type Variant = 'admin' | 'team' | 'personal'

interface Props {
  variant: Variant
  /** admin / team variant용 */
  items?: OnboardingItem[]
  /** personal variant용 */
  personal?: OnboardingItem | null
  loading?: boolean
  className?: string
}

// ─── Helpers ────────────────────────────────────────────────

function formatDday(days: number | null | undefined, t: ReturnType<typeof useTranslations>): string {
  if (days == null) return '-'
  // daysUntilStart: positive = future (D-n), negative = past/in-progress (D+n)
  if (days > 0) return t('onboardingTracker.daysUntilStart', { days })
  return t('onboardingTracker.daysSinceStart', { days: -days })
}

// ─── Component ──────────────────────────────────────────────

export function OnboardingTracker({ variant, items, personal, loading, className }: Props) {
  const t = useTranslations('home')

  // ── Loading ──
  if (loading) {
    return <WidgetSkeleton height={variant === 'personal' ? 'h-48' : 'h-40'} lines={3} />
  }

  // ── Personal variant ──
  if (variant === 'personal') {
    if (!personal) return null
    return (
      <section
        className={cn('rounded-2xl bg-card p-6 shadow-sm', className)}
        aria-labelledby="onboarding-tracker-personal-title"
      >
        <header className="mb-3 flex items-center gap-2">
          <UserPlus className="h-4 w-4 stroke-[1.5] text-primary" aria-hidden="true" />
          <h2 id="onboarding-tracker-personal-title" className="text-sm font-semibold text-foreground">
            {t('onboardingTracker.title')}
          </h2>
        </header>
        <div className="flex flex-col items-center py-2">
          <p className={cn(TYPOGRAPHY.displaySm, 'text-primary')} aria-hidden="true">
            {personal.progress}%
          </p>
          {personal.totalTasks > 0 && (
            <div
              role="progressbar"
              aria-valuenow={personal.progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t('progress.tasks', { completed: personal.completedTasks, total: personal.totalTasks })}
              className="mt-3 h-1.5 w-full max-w-[240px] overflow-hidden rounded-full bg-muted motion-safe:transition-all"
            >
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${personal.progress}%` }}
              />
            </div>
          )}
          <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
            {t('onboardingTracker.progressLabel', { completed: personal.completedTasks, total: personal.totalTasks })}
          </p>
        </div>
      </section>
    )
  }

  // ── Admin / Team variant (공통 컨테이너) ──
  const isEmpty = !items || items.length === 0
  const titleId = `onboarding-tracker-${variant}-title`

  return (
    <section
      className={cn('rounded-2xl bg-card p-6 shadow-sm', className)}
      aria-labelledby={titleId}
    >
      <header className="mb-3 flex items-center justify-between">
        <h2 id={titleId} className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <UserPlus className="h-4 w-4 stroke-[1.5] text-primary" aria-hidden="true" />
          {t('onboardingTracker.title')}
        </h2>
        {/* /onboarding은 HR_UP only — team variant(매니저용)에서는 링크 노출 안 함 */}
        {variant === 'admin' && (
          <Link
            href="/onboarding"
            className="text-[11px] font-semibold text-primary hover:underline"
          >
            {t('onboardingTracker.viewAll')}
          </Link>
        )}
      </header>

      {isEmpty ? (
        <p className="py-4 text-center text-xs text-muted-foreground">
          {t('emptyState.onboardingAdmin')}
        </p>
      ) : variant === 'team' ? (
        // Team variant: 1명 강조
        (() => {
          const first = items[0]
          return (
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary text-[13px] font-bold text-white"
                aria-hidden="true"
              >
                {first.name[0]}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-foreground">{first.name}</p>
                {first.department && (
                  <p className="truncate text-[11px] text-muted-foreground">{first.department}</p>
                )}
              </div>
              <StatusBadge variant="info">{formatDday(first.daysUntilStart, t)}</StatusBadge>
            </div>
          )
        })()
      ) : (
        // Admin variant: 최대 3명 리스트
        <div role="list" className="flex flex-col gap-3">
          {items.slice(0, 3).map((item) => (
            <article key={item.employeeId} role="listitem" className="flex flex-col gap-1.5">
              {/* Row 1: D-day + avatar + name/dept */}
              <div className="flex items-center gap-2">
                <StatusBadge variant="info">{formatDday(item.daysUntilStart, t)}</StatusBadge>
                <div
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary text-[11px] font-bold text-white"
                  aria-hidden="true"
                >
                  {item.name[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-foreground">{item.name}</p>
                  {item.department && (
                    <p className="truncate text-[10px] text-muted-foreground">{item.department}</p>
                  )}
                </div>
              </div>
              {/* Row 2: progress bar (determinate only) */}
              {item.totalTasks > 0 && (
                <div className="flex items-center gap-2">
                  <div
                    role="progressbar"
                    aria-valuenow={item.progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={t('progress.tasks', { completed: item.completedTasks, total: item.totalTasks })}
                    className="h-1 flex-1 overflow-hidden rounded-full bg-muted motion-safe:transition-all"
                  >
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                  <span className="whitespace-nowrap text-[9px] tabular-nums text-muted-foreground">
                    {item.completedTasks}/{item.totalTasks}
                  </span>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
