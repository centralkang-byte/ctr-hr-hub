'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Employee Home V2 (R3 Dashboard Pilot)
// R1 primitive 기반 재구성: Hero + 4 StatCard (trend 없음) + 조건부 MyOnboarding/Offboarding 카드.
// V1(EmployeeHome.tsx)과 공존 — /home-preview/employee에서만 렌더.
// 결정 사항:
// - EMPLOYEE는 개인 데이터 희소성으로 sparkline/trend 생략.
// - myTeamSize는 같은 매니저 아래 동료 수 (src/lib/employee/peers.ts).
// - V1의 MyOnboarding/MyOffboarding 특수 카드 패턴 유지 (EmployeeHome.tsx:123 참조).
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  Calendar,
  Target,
  CheckCircle2,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ELEVATION, MOTION, TYPOGRAPHY } from '@/lib/styles'
import { DashboardHomeShell, HomeGrid, HomeSection, HomeStack } from './shell/DashboardHomeShell'
import { HeroCard } from './primitives/HeroCard'
import { StatCard } from './primitives/StatCard'
import { InsightStrip } from './primitives/InsightStrip'
import { DashboardErrorBanner } from './DashboardErrorBanner'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import type { SessionUser, EmployeeSummary, OnboardingItem, LeaveBalanceItem } from '@/types'

// ─── Types ──────────────────────────────────────────────────

interface Props {
  user: SessionUser
}

type HeroFocusKind = 'offboarding' | 'onboarding' | 'review' | 'leaveForfeit' | 'greeting'

// ─── Helpers ────────────────────────────────────────────────

function pickAnnualRemaining(balance: LeaveBalanceItem[]): number | null {
  const annual = balance.find((b) => b.leaveType === 'ANNUAL')
  return annual ? annual.remaining : null
}

function hasLowLeaveBalance(balance: LeaveBalanceItem[]): boolean {
  return balance.some((b) => b.remaining > 0 && b.remaining < 3)
}

/**
 * Codex Gate 2 P2 fix: 실제 QuarterlyReview enum은 DRAFT|IN_PROGRESS|EMPLOYEE_DONE|MANAGER_DONE|COMPLETED.
 * API에서 해당 분기 review가 없으면 `{ id: null, status: null }` 반환 → null을 "not started"로 해석.
 */
function reviewNotStartedYet(status: string | null | undefined): boolean {
  return status == null || status === 'DRAFT'
}

function pickHeroFocus(summary: EmployeeSummary | null): HeroFocusKind {
  if (!summary) return 'greeting'

  const offboardingSoon =
    summary.myOffboarding != null &&
    summary.myOffboarding.daysUntilStart != null &&
    summary.myOffboarding.daysUntilStart <= 14
  const onboardingBehind =
    summary.myOnboarding != null && summary.myOnboarding.progress < 50
  const reviewPending = reviewNotStartedYet(summary.quarterlyReview?.status)
  const lowLeaveBalance = hasLowLeaveBalance(summary.leaveBalance)

  const scores = {
    offboarding: offboardingSoon ? 5 : 0,
    onboarding: onboardingBehind ? 3 : 0,
    review: reviewPending ? 2 : 0,
    leaveForfeit: lowLeaveBalance ? 1 : 0,
  }
  const max = Math.max(...Object.values(scores))
  if (max <= 0) return 'greeting'
  if (scores.offboarding === max) return 'offboarding'
  if (scores.onboarding === max) return 'onboarding'
  if (scores.review === max) return 'review'
  return 'leaveForfeit'
}

function quarterlyReviewTone(
  status: string | null | undefined,
): 'success' | 'warning' | 'info' | 'default' {
  if (status === 'COMPLETED') return 'success'
  if (status == null) return 'warning' // 해당 분기 review 없음 — 미작성
  if (status === 'DRAFT') return 'warning' // 저장만 했고 제출 안 함
  if (
    status === 'IN_PROGRESS' ||
    status === 'EMPLOYEE_DONE' ||
    status === 'MANAGER_DONE'
  ) {
    return 'info'
  }
  return 'default'
}

function quarterlyReviewLabelKey(status: string | null | undefined): string {
  switch (status) {
    case 'COMPLETED':
      return 'stat.reviewStatus.completed'
    case 'IN_PROGRESS':
      return 'stat.reviewStatus.inProgress'
    case 'DRAFT':
      return 'stat.reviewStatus.draft'
    case 'EMPLOYEE_DONE':
      return 'stat.reviewStatus.employeeDone'
    case 'MANAGER_DONE':
      return 'stat.reviewStatus.managerDone'
    case null:
    case undefined:
      return 'stat.reviewStatus.notStarted'
    default:
      return 'stat.reviewStatus.notStarted'
  }
}

// ─── Component ──────────────────────────────────────────────

export function EmployeeHomeV2({ user }: Props) {
  const t = useTranslations('home.employee.v2')
  const [summary, setSummary] = useState<EmployeeSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchSummary = useCallback(async () => {
    setError(false)
    setLoading(true)
    try {
      const res = await apiClient.get<EmployeeSummary>('/api/v1/home/summary')
      setSummary(res.data)
    } catch (err) {
      setError(true)
      toast({
        title: '로드 실패',
        description: err instanceof Error ? err.message : '다시 시도해 주세요.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchSummary()
  }, [fetchSummary])

  // ── Derived ────────────────────────────────────────────
  const annualRemaining = summary ? pickAnnualRemaining(summary.leaveBalance) : null
  const attendanceThisMonth = summary?.attendanceThisMonth ?? 0
  const reviewStatus = summary?.quarterlyReview?.status ?? null
  const myTeamSize = summary?.myTeamSize ?? 0

  const myOnboarding: OnboardingItem | null = summary?.myOnboarding ?? null
  const myOffboarding: OnboardingItem | null = summary?.myOffboarding ?? null

  const focusKind = pickHeroFocus(summary)
  const lowLeaveBalance = summary ? hasLowLeaveBalance(summary.leaveBalance) : false

  // Hero focus resolution
  const heroFocus = (() => {
    switch (focusKind) {
      case 'offboarding':
        return {
          title: t('hero.focusOffboarding', {
            days: myOffboarding?.daysUntilStart ?? 0,
          }),
          description: t('hero.focusOffboardingDesc'),
          cta: { label: t('hero.cta.checklist'), href: '/my/offboarding' },
          illustration: 'focus' as const,
        }
      case 'onboarding':
        return {
          title: t('hero.focusOnboarding', { progress: myOnboarding?.progress ?? 0 }),
          description: t('hero.focusOnboardingDesc'),
          cta: { label: t('hero.cta.checklist'), href: '/my/onboarding' },
          illustration: 'focus' as const,
        }
      case 'review':
        return {
          title: t('hero.focusReview'),
          description: t('hero.focusReviewDesc'),
          cta: { label: t('hero.cta.writeReview'), href: '/my/quarterly-review' },
          illustration: 'focus' as const,
        }
      case 'leaveForfeit':
        return {
          title: t('hero.focusLeaveForfeit'),
          description: t('hero.focusLeaveForfeitDesc'),
          cta: { label: t('hero.cta.leaveRequest'), href: '/my/leave' },
          illustration: 'sunrise' as const,
        }
      default:
        return {
          title: t('hero.focusGreeting'),
          description: t('hero.focusGreetingDesc'),
          cta: { label: t('hero.cta.myPage'), href: '/my' },
          illustration: 'sunrise' as const,
        }
    }
  })()

  const greetingKey = new Date().getHours() < 12 ? 'hero.greetingAm' : 'hero.greetingPm'

  // ── Error state ───────────────────────────────────────
  if (error && !summary) {
    return (
      <DashboardHomeShell>
        <DashboardErrorBanner
          message={t('loadError')}
          onRetry={() => void fetchSummary()}
        />
      </DashboardHomeShell>
    )
  }

  // ── Conditional tracker cards ─────────────────────────
  const hasTrackers = myOnboarding != null || myOffboarding != null

  // Insight: lowLeaveBalance but Hero didn't pick it (즉 다른 우선순위가 있었음)
  const showLeaveForfeitInsight = lowLeaveBalance && focusKind !== 'leaveForfeit'

  // ── Render ────────────────────────────────────────────
  return (
    <DashboardHomeShell>
      {/* Hero */}
      <HomeSection title={t('section.hero')} srOnly>
        <HeroCard
          greeting={t(greetingKey, { name: user.name ?? '' })}
          focus={{
            title: heroFocus.title,
            description: heroFocus.description,
            cta: heroFocus.cta,
          }}
          illustration={heroFocus.illustration}
        />
      </HomeSection>

      {/* KPI StatCards (no trends) */}
      <HomeSection title={t('section.stat')} srOnly>
        <HomeGrid cols={4}>
          <StatCard
            label={t('stat.annualRemaining')}
            value={loading ? '—' : annualRemaining != null ? annualRemaining : '—'}
            loading={loading}
            tone={annualRemaining != null && annualRemaining < 3 ? 'warning' : 'info'}
            action={{ label: t('stat.viewLeave'), href: '/my/leave' }}
          />
          <StatCard
            label={t('stat.attendanceThisMonth')}
            value={loading ? '—' : attendanceThisMonth}
            loading={loading}
            action={{ label: t('stat.viewAttendance'), href: '/my/attendance' }}
          />
          <StatCard
            label={t('stat.reviewStatus.label')}
            value={loading ? '—' : t(quarterlyReviewLabelKey(reviewStatus))}
            loading={loading}
            tone={quarterlyReviewTone(reviewStatus)}
            action={{ label: t('stat.viewReview'), href: '/my/quarterly-review' }}
          />
          <StatCard
            label={t('stat.myTeamSize')}
            value={loading ? '—' : myTeamSize}
            loading={loading}
            action={{ label: t('stat.viewTeam'), href: '/my/team' }}
          />
        </HomeGrid>
      </HomeSection>

      {/* Conditional personal tracker cards — V1 패턴 유지 */}
      {hasTrackers ? (
        <HomeSection title={t('section.tracker')} srOnly>
          <HomeGrid cols={myOnboarding && myOffboarding ? 2 : 1}>
            {myOnboarding ? (
              <PersonalTrackerCard
                kind="onboarding"
                item={myOnboarding}
                title={t('tracker.onboarding.title')}
                subtitle={t('tracker.onboarding.subtitle', {
                  progress: myOnboarding.progress,
                  days: myOnboarding.daysUntilStart ?? 0,
                })}
                href="/my/onboarding"
                hrefLabel={t('tracker.onboarding.cta')}
                accentIcon={Target}
              />
            ) : null}
            {myOffboarding ? (
              <PersonalTrackerCard
                kind="offboarding"
                item={myOffboarding}
                title={t('tracker.offboarding.title')}
                subtitle={t('tracker.offboarding.subtitle', {
                  progress: myOffboarding.progress,
                  days: myOffboarding.daysUntilStart ?? 0,
                })}
                href="/my/offboarding"
                hrefLabel={t('tracker.offboarding.cta')}
                accentIcon={Calendar}
              />
            ) : null}
          </HomeGrid>
        </HomeSection>
      ) : null}

      {/* Conditional insight — Hero가 선택하지 않은 잔여 warning 노출 */}
      {showLeaveForfeitInsight ? (
        <HomeSection title={t('section.insight')} srOnly>
          <HomeStack gap="sm">
            <InsightStrip
              kind="ai-suggestion"
              icon={Sparkles}
              message={t('insight.leaveForfeitMsg')}
              action={{ label: t('insight.leaveForfeitCta'), href: '/my/leave' }}
            />
          </HomeStack>
        </HomeSection>
      ) : null}

      {/* Partial error during refresh */}
      {error && summary ? (
        <DashboardErrorBanner
          message={t('loadError')}
          onRetry={() => void fetchSummary()}
        />
      ) : null}
    </DashboardHomeShell>
  )
}

// ─── Personal Tracker Card (EmployeeHomeV2 내 로컬 컴포넌트) ─

interface PersonalTrackerCardProps {
  kind: 'onboarding' | 'offboarding'
  item: OnboardingItem
  title: string
  subtitle: string
  href: string
  hrefLabel: string
  accentIcon: React.ComponentType<{ className?: string }>
}

function PersonalTrackerCard({
  kind,
  item,
  title,
  subtitle,
  href,
  hrefLabel,
  accentIcon: AccentIcon,
}: PersonalTrackerCardProps) {
  const progress = item.progress
  const sectionId = `personal-${kind}-tracker`

  return (
    <section
      aria-labelledby={sectionId}
      className={cn(
        'flex flex-col gap-3 rounded-2xl bg-card p-5',
        ELEVATION.xs,
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'inline-flex h-8 w-8 items-center justify-center rounded-lg',
            kind === 'onboarding' ? 'bg-primary/10 text-primary' : 'bg-warning-bright/15 text-ctr-warning',
          )}
          aria-hidden="true"
        >
          <AccentIcon className="h-4 w-4" />
        </span>
        <h3 id={sectionId} className="text-sm font-semibold text-foreground">
          {title}
        </h3>
      </div>

      <p className={cn(TYPOGRAPHY.caption, 'text-muted-foreground')}>{subtitle}</p>

      {/* Progress bar */}
      <div
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${title}: ${item.completedTasks}/${item.totalTasks}`}
        className="h-1.5 w-full rounded-full bg-muted"
      >
        <div
          className={cn(
            'h-full rounded-full transition-all',
            progress >= 70 ? 'bg-primary' : progress >= 40 ? 'bg-warning-bright' : 'bg-destructive',
          )}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center justify-between">
        <Link
          href={href}
          className={cn(
            'inline-flex min-h-[44px] items-center gap-1 text-xs font-medium text-primary',
            'hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:rounded-sm',
            MOTION.microOut,
          )}
        >
          {hrefLabel}
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
        {progress >= 100 ? (
          <span
            className="inline-flex items-center gap-1 text-xs text-[#15803d]"
            aria-label="완료됨"
          >
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        ) : null}
      </div>
    </section>
  )
}
