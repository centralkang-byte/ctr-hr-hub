'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — HR Admin Home V2 (R3 Dashboard Pilot)
// R1 primitive 기반 재구성: QuickActions row + Hero + 4 StatCard + 2 ListCard (+ 조건부 Insight).
// V1(HrAdminHome.tsx)과 공존 — /home-preview/hr-admin에서만 렌더 (env + role gated).
// Codex Gate 1 HIGH: V1 3개 QuickAction(Register Employee/Run Payroll/Reports)은
//   HeroCard.secondary가 max 2이므로 Hero 위에 별도 row로 배치 — focus-first 계약 유지.
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  Pencil,
  FileText,
  UserPlus,
  DollarSign,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MOTION } from '@/lib/styles'
import { DashboardHomeShell, HomeGrid, HomeSection, HomeStack } from './shell/DashboardHomeShell'
import { HeroCard } from './primitives/HeroCard'
import { StatCard } from './primitives/StatCard'
import { ListCard } from './primitives/ListCard'
import { EmptyState } from './primitives/EmptyState'
import { InsightStrip } from './primitives/InsightStrip'
import { DashboardErrorBanner } from './DashboardErrorBanner'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { useTimeOfDay } from '@/hooks/useTimeOfDay'
import type { SessionUser, HrAdminSummary, OnboardingItem } from '@/types'

// ─── Types ──────────────────────────────────────────────────

interface Props {
  user: SessionUser
}

type HeroFocusKind = 'urgent' | 'weekDeadline' | 'openPositions' | 'all-clear'

interface QuickAction {
  icon: LucideIcon
  label: string
  href: string
}

// ─── Helpers ────────────────────────────────────────────────

/**
 * Codex Gate 1 pattern: normalized severity scoring (first-match 왜곡 방지).
 * urgent(연체) × 3, weekDeadline(이번 주 마감) × 2, openPositions × 1.
 */
function pickHeroFocus(summary: HrAdminSummary | null): HeroFocusKind {
  if (!summary) return 'all-clear'
  const urgent = summary.urgentCount ?? 0
  const weekDeadline = summary.weekDeadlineCount ?? 0
  const openPositions = summary.openPositions ?? 0

  const scores = {
    urgent: urgent * 3,
    weekDeadline: weekDeadline * 2,
    openPositions: openPositions * 1,
  }
  const max = Math.max(scores.urgent, scores.weekDeadline, scores.openPositions)
  if (max <= 0) return 'all-clear'
  if (scores.urgent === max) return 'urgent'
  if (scores.weekDeadline === max) return 'weekDeadline'
  return 'openPositions'
}

function listItemStatusForOnboarding(progress: number): 'success' | 'warning' | 'error' {
  if (progress >= 70) return 'success'
  if (progress >= 40) return 'warning'
  return 'error'
}

function listItemStatusForOffboarding(
  daysUntilStart: number | null | undefined,
): 'success' | 'warning' | 'error' {
  if (daysUntilStart == null) return 'warning'
  if (daysUntilStart < 0) return 'error'
  if (daysUntilStart <= 7) return 'warning'
  return 'success'
}

function sparkTrendDirection(data: number[]): 'up' | 'down' | 'flat' {
  if (data.length < 2) return 'flat'
  const first = data[0]
  const last = data[data.length - 1]
  if (last > first) return 'up'
  if (last < first) return 'down'
  return 'flat'
}

// ─── Component ──────────────────────────────────────────────

export function HrAdminHomeV2({ user }: Props) {
  const t = useTranslations('home.hrAdmin.v2')
  const timeOfDay = useTimeOfDay()
  const [summary, setSummary] = useState<HrAdminSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchSummary = useCallback(async () => {
    setError(false)
    setLoading(true)
    try {
      const res = await apiClient.get<HrAdminSummary>('/api/v1/home/summary')
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
  const totalEmployees = summary?.totalEmployees ?? 0
  const pendingLeaves = summary?.pendingLeaves ?? 0
  const urgentCount = summary?.urgentCount ?? 0
  const weekDeadlineCount = summary?.weekDeadlineCount ?? 0
  const openPositions = summary?.openPositions ?? 0
  const turnoverRate = summary?.turnoverRate ?? 0
  const newHires = summary?.newHires ?? 0
  const onboardingCount = summary?.onboardingCount ?? 0

  const focusKind = pickHeroFocus(summary)
  const newHiresSpark = (summary?.newHiresTrend ?? []).map((p) => p.value)
  const pendingLeavesSpark = (summary?.pendingLeavesTrend ?? []).map((p) => p.value)

  const activeOnboarding: OnboardingItem[] = summary?.activeOnboarding ?? []
  const activeOffboarding: OnboardingItem[] = summary?.activeOffboarding ?? []

  // ── Quick actions (V1 preserved, Codex Gate 1 HIGH fix) ──
  const quickActions: QuickAction[] = [
    { icon: UserPlus, label: t('quickActions.registerEmployee'), href: '/employees/new' },
    { icon: DollarSign, label: t('quickActions.runPayroll'), href: '/payroll' },
    { icon: BarChart3, label: t('quickActions.reports'), href: '/analytics' },
  ]

  // Hero focus resolution
  const heroFocus = (() => {
    switch (focusKind) {
      case 'urgent':
        return {
          title: t('hero.focusUrgent', { count: urgentCount }),
          description: t('hero.focusUrgentDesc'),
          cta: { label: t('hero.cta.open'), href: '/approvals/inbox' },
          illustration: 'focus' as const,
        }
      case 'weekDeadline':
        return {
          title: t('hero.focusWeekDeadline', { count: weekDeadlineCount }),
          description: t('hero.focusWeekDeadlineDesc'),
          cta: { label: t('hero.cta.open'), href: '/approvals/inbox' },
          illustration: timeOfDay === 'pm' ? ('focus' as const) : ('sunrise' as const),
        }
      case 'openPositions':
        return {
          title: t('hero.focusOpenPositions', { count: openPositions }),
          description: t('hero.focusOpenPositionsDesc'),
          cta: { label: t('hero.cta.view'), href: '/recruitment' },
          illustration: 'focus' as const,
        }
      default:
        return {
          title: t('hero.focusAllClear'),
          description: t('hero.focusAllClearDesc'),
          cta: { label: t('hero.cta.view'), href: '/analytics' },
          illustration: 'celebration' as const,
        }
    }
  })()

  // SSR/초기 hydration 중에는 timeOfDay === null → AM 을 디폴트로 렌더.
  const greetingKey = timeOfDay === 'pm' ? 'hero.greetingPm' : 'hero.greetingAm'

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

  // ── Conditional insight flags ─────────────────────────
  const showUrgentInsight = urgentCount > 0
  const showOrphanHiresInsight = newHires > 0 && onboardingCount === 0

  // ── Render ────────────────────────────────────────────
  return (
    <DashboardHomeShell>
      {/* Quick Actions row — V1 UX 보존 (Codex Gate 1 HIGH) */}
      <HomeSection title={t('section.quickActions')} srOnly>
        <div className="flex flex-wrap gap-2">
          {quickActions.map((qa) => {
            const Icon = qa.icon
            return (
              <Link
                key={qa.href}
                href={qa.href}
                aria-label={qa.label}
                className={cn(
                  'inline-flex min-h-[44px] items-center gap-2 rounded-full border border-border/60 bg-card px-4 text-sm font-medium text-foreground',
                  'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  MOTION.microOut,
                )}
              >
                <Icon className="h-4 w-4 stroke-[1.5]" aria-hidden="true" />
                {qa.label}
              </Link>
            )
          })}
        </div>
      </HomeSection>

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

      {/* KPI StatCards */}
      <HomeSection title={t('section.stat')} srOnly>
        <HomeGrid cols={4}>
          <StatCard
            label={t('stat.totalEmployees')}
            value={loading ? '—' : totalEmployees}
            loading={loading}
            tone="info"
            sparkline={newHiresSpark.length > 0 ? newHiresSpark : undefined}
            trend={
              newHiresSpark.length > 0
                ? {
                    direction: sparkTrendDirection(newHiresSpark),
                    delta: t('stat.newHiresDelta', { count: newHires }),
                    sr: t('stat.newHiresSr', { count: newHires }),
                  }
                : undefined
            }
            action={{ label: t('stat.viewEmployees'), href: '/employees' }}
          />
          <StatCard
            label={t('stat.pendingLeaves')}
            value={loading ? '—' : pendingLeaves}
            loading={loading}
            tone={urgentCount > 0 ? 'error' : pendingLeaves > 0 ? 'warning' : 'default'}
            sparkline={pendingLeavesSpark.length > 0 ? pendingLeavesSpark : undefined}
            trend={
              pendingLeavesSpark.length > 0
                ? {
                    direction: sparkTrendDirection(pendingLeavesSpark),
                    delta: t('stat.pendingLeavesDelta', { count: pendingLeaves }),
                    sr: t('stat.pendingLeavesSr', { count: pendingLeaves }),
                  }
                : undefined
            }
            action={{ label: t('stat.viewApprovals'), href: '/approvals/inbox' }}
          />
          <StatCard
            label={t('stat.turnoverRate')}
            value={loading ? '—' : `${turnoverRate}%`}
            loading={loading}
            tone={turnoverRate >= 5 ? 'warning' : 'default'}
            action={{ label: t('stat.viewTurnover'), href: '/analytics/turnover' }}
          />
          <StatCard
            label={t('stat.openPositions')}
            value={loading ? '—' : openPositions}
            loading={loading}
            tone="info"
            action={{ label: t('stat.viewRecruitment'), href: '/recruitment' }}
          />
        </HomeGrid>
      </HomeSection>

      {/* Lists */}
      <HomeSection title={t('section.list')} srOnly>
        <HomeGrid cols={2}>
          <ListCard
            title={t('list.onboarding')}
            items={activeOnboarding}
            maxRows={5}
            viewAllHref="/onboarding"
            viewAllLabel={t('list.viewAll')}
            renderItem={(item) => ({
              id: item.employeeId,
              primary: item.department ? `${item.name} — ${item.department}` : item.name,
              secondary: t('list.onboardingRow', {
                progress: item.progress,
                days: item.daysUntilStart ?? 0,
              }),
              statusDot: listItemStatusForOnboarding(item.progress),
              statusLabel: t(`list.onboardingStatus.${listItemStatusForOnboarding(item.progress)}`),
              // TODO: href requires onboardingId from API (employeeId won't work). Non-clickable for now.
            })}
            actions={() => [
              { icon: Pencil, label: t('list.action.edit'), onClick: () => undefined },
              { icon: FileText, label: t('list.action.doc'), onClick: () => undefined },
            ]}
            emptyState={
              <EmptyState
                icon={UserPlus}
                title={t('empty.onboarding.title')}
                description={t('empty.onboarding.desc')}
              />
            }
          />
          <ListCard
            title={t('list.offboarding')}
            items={activeOffboarding}
            maxRows={5}
            viewAllHref="/offboarding"
            viewAllLabel={t('list.viewAll')}
            renderItem={(item) => ({
              id: item.employeeId,
              primary: item.name,
              secondary: t('list.offboardingRow', {
                progress: item.progress,
                days: item.daysUntilStart ?? 0,
              }),
              statusDot: listItemStatusForOffboarding(item.daysUntilStart),
              statusLabel: t(
                `list.offboardingStatus.${listItemStatusForOffboarding(item.daysUntilStart)}`,
              ),
              // TODO: href requires offboardingId from API (employeeId won't work). Non-clickable for now.
            })}
            emptyState={
              <EmptyState
                icon={CheckCircle2}
                title={t('empty.offboarding.title')}
                description={t('empty.offboarding.desc')}
                tone="success"
              />
            }
          />
        </HomeGrid>
      </HomeSection>

      {/* Conditional insight */}
      {showUrgentInsight || showOrphanHiresInsight ? (
        <HomeSection title={t('section.insight')} srOnly>
          <HomeStack gap="sm">
            {showUrgentInsight ? (
              <InsightStrip
                kind="ai-suggestion"
                icon={Sparkles}
                message={t('insight.urgentMsg', { count: urgentCount })}
                action={{ label: t('insight.urgentCta'), href: '/approvals/inbox' }}
              />
            ) : null}
            {showOrphanHiresInsight ? (
              <InsightStrip
                kind="announcement"
                icon={AlertCircle}
                message={t('insight.orphanHiresMsg', { count: newHires })}
                action={{ label: t('insight.orphanHiresCta'), href: '/onboarding' }}
              />
            ) : null}
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
