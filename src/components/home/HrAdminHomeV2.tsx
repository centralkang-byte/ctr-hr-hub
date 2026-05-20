'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — HR Admin Home V2 (PR-5A Workday Reskin)
// V1(HrAdminHome.tsx)과 공존 — /home-preview/hr-admin에서만 렌더 (env + role gated).
// PR-5A: HeroCard → WorkdayHero / QuickActions row 제거 (워클릿 대체) /
//         WorkletGrid + ApprovalPreview 신규 / StatCard·ListCard·InsightStrip 유지
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import {
  Pencil,
  FileText,
  UserPlus,
  Users,
  Briefcase,
  Clock,
  CalendarDays,
  Target as TargetIcon,
  Wallet,
  Building2,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react'
import { DashboardHomeShell, HomeGrid, HomeSection, HomeStack } from './shell/DashboardHomeShell'
import { WorkdayHero } from './primitives/WorkdayHero'
import { WorkletGrid, type WorkletTile } from './primitives/WorkletGrid'
import { ApprovalPreview } from './primitives/ApprovalPreview'
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

// ─── Helpers ────────────────────────────────────────────────

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
  const locale = useLocale()
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
  const openPositions = summary?.openPositions ?? 0
  const turnoverRate = summary?.turnoverRate ?? 0
  const newHires = summary?.newHires ?? 0
  const onboardingCount = summary?.onboardingCount ?? 0

  const newHiresSpark = (summary?.newHiresTrend ?? []).map((p) => p.value)
  const pendingLeavesSpark = (summary?.pendingLeavesTrend ?? []).map((p) => p.value)

  const activeOnboarding: OnboardingItem[] = summary?.activeOnboarding ?? []
  const activeOffboarding: OnboardingItem[] = summary?.activeOffboarding ?? []

  const attendanceToday = summary?.attendanceToday
  const topPendingApprovals = summary?.topPendingApprovals ?? []

  // ── WorkdayHero derived ────────────────────────────────
  // SSR/초기 hydration 중에는 timeOfDay === null → AM 디폴트.
  const greetingKey = timeOfDay === 'pm' ? 'workdayHero.greetingPm' : 'workdayHero.greetingAm'
  const greeting = t(greetingKey, { name: user.name ?? '' })
  // 날짜 SSOT: P2-2 정정 — Intl.DateTimeFormat locale 기반 (한국어 리터럴 의존 제거).
  // timeZone: Asia/Seoul 유지 (회사 timezone 기본, Phase 6에서 user.companyId 기반 해소).
  const dateStr = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    timeZone: 'Asia/Seoul',
  }).format(new Date())

  // 총 처리 건수 = pendingLeaves + delayed onboarding
  const delayedOnboardingCount = activeOnboarding.filter(
    (o) => listItemStatusForOnboarding(o.progress) === 'error',
  ).length
  const totalActions = pendingLeaves + delayedOnboardingCount

  // ── Worklet tiles (proto SSOT 1-8) ─────────────────────
  // subtitle / inline 데이터는 summary derive — payroll/organization 은 i18n 정적 (PR-5C 동적화 후보)
  const workletTiles: WorkletTile[] = [
    {
      id: 'employees',
      icon: Users,
      tone: 'primary',
      title: t('worklet.employees.title'),
      subtitle: t('worklet.employees.subtitle', { total: totalEmployees, newHires }),
      href: '/employees',
      inline: [
        {
          tone: newHires > 0 ? 'neutral' : 'neutral',
          toneLabel: t('worklet.inline.neutral'),
          text: t('worklet.employees.inline1', { count: newHires }),
        },
      ],
    },
    {
      id: 'recruitment',
      icon: Briefcase,
      tone: 'tertiary',
      title: t('worklet.recruitment.title'),
      subtitle: t('worklet.recruitment.subtitle', { open: openPositions }),
      href: '/recruitment',
      count: openPositions > 0 ? openPositions : undefined,
    },
    {
      id: 'attendance',
      icon: Clock,
      tone: 'chart-2',
      title: t('worklet.attendance.title'),
      subtitle: attendanceToday
        ? t('worklet.attendance.subtitle', {
            present: attendanceToday.present,
            late: attendanceToday.late,
          })
        : t('worklet.attendance.subtitleEmpty'),
      href: '/attendance',
      inline: attendanceToday
        ? [
            {
              tone: attendanceToday.absent > 0 ? 'danger' : 'neutral',
              toneLabel:
                attendanceToday.absent > 0
                  ? t('worklet.inline.danger')
                  : t('worklet.inline.neutral'),
              text: t('worklet.attendance.inline1', { absent: attendanceToday.absent }),
            },
            {
              tone: attendanceToday.late > 0 ? 'warn' : 'neutral',
              toneLabel:
                attendanceToday.late > 0
                  ? t('worklet.inline.warn')
                  : t('worklet.inline.neutral'),
              text: t('worklet.attendance.inline2', { late: attendanceToday.late }),
            },
          ]
        : undefined,
    },
    {
      id: 'leave',
      icon: CalendarDays,
      tone: 'wd-orange',
      title: t('worklet.leave.title'),
      subtitle: t('worklet.leave.subtitle', { pending: pendingLeaves }),
      href: '/leave',
      count: pendingLeaves > 0 ? pendingLeaves : undefined,
      inline:
        urgentCount > 0
          ? [
              {
                tone: 'danger',
                toneLabel: t('worklet.inline.danger'),
                text: t('worklet.leave.inline1', { count: urgentCount }),
              },
            ]
          : undefined,
    },
    {
      id: 'performance',
      icon: TargetIcon,
      tone: 'badge-accent',
      title: t('worklet.performance.title'),
      subtitle: summary?.quarterlyReviewStats
        ? t('worklet.performance.subtitle', {
            rate: summary.quarterlyReviewStats.completionRate ?? 0,
            completed: summary.quarterlyReviewStats.completed ?? 0,
            total: summary.quarterlyReviewStats.total ?? 0,
          })
        : t('worklet.performance.subtitleEmpty'),
      href: '/performance',
    },
    {
      id: 'payroll',
      icon: Wallet,
      tone: 'warning-bright',
      title: t('worklet.payroll.title'),
      subtitle: t('worklet.payroll.subtitle'),
      href: '/payroll',
    },
    {
      id: 'organization',
      icon: Building2,
      tone: 'chart-4',
      title: t('worklet.organization.title'),
      subtitle: t('worklet.organization.subtitle'),
      href: '/organization',
    },
    {
      id: 'analytics',
      icon: BarChart3,
      tone: 'info',
      title: t('worklet.analytics.title'),
      subtitle: t('worklet.analytics.subtitle', { rate: turnoverRate }),
      href: '/analytics',
    },
  ]

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
      {/* WorkdayHero — navy 그라데이션 (PR-5A) */}
      <HomeSection title={t('section.hero')} srOnly>
        <WorkdayHero
          greeting={greeting}
          dateStr={dateStr}
          totalActions={totalActions}
          overdueCount={urgentCount}
          copyTemplate={{
            before: t('workdayHero.subBefore'),
            middle: t('workdayHero.subMiddle'),
            after: t('workdayHero.subAfter'),
          }}
          kpis={{
            headcount: {
              value: loading ? '—' : totalEmployees,
              label: t('workdayHero.kpi.headcount'),
            },
            openRoles: {
              value: loading ? '—' : openPositions,
              label: t('workdayHero.kpi.openRoles'),
            },
            turnoverRate: {
              value: loading ? '—' : `${turnoverRate}%`,
              label: t('workdayHero.kpi.turnoverRate'),
            },
          }}
          ctaPrimary={{ label: t('workdayHero.ctaInbox'), href: '/approvals/inbox' }}
          ctaSecondary={{ label: t('workdayHero.ctaAlerts'), href: '/notifications' }}
        />
      </HomeSection>

      {/* KPI StatCards — 기존 유지 */}
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

      {/* WorkletGrid — 8 distinct colored 타일 (PR-5A) */}
      <HomeSection title={t('worklet.heading')}>
        <WorkletGrid tiles={workletTiles} />
      </HomeSection>

      {/* ApprovalPreview — top 4 pending (PR-5A) */}
      <HomeSection title={t('approvalPreview.heading')} srOnly>
        <ApprovalPreview
          items={topPendingApprovals}
          totalCount={pendingLeaves}
          viewAllHref="/approvals/inbox"
          headingLabel={t('approvalPreview.heading')}
          subHeadingLabel={t('approvalPreview.subHeading', { count: pendingLeaves })}
          viewAllLabel={t('approvalPreview.viewAll')}
          urgencyLabels={{
            overdue: t('approvalPreview.urgency.overdue'),
            today: t('approvalPreview.urgency.today'),
            queued: t('approvalPreview.urgency.queued'),
          }}
          approveLabel={t('approvalPreview.approveCta')}
          submittedFormatter={(iso) =>
            // P2-2 정정: locale-aware. Intl.DateTimeFormat이 localized 단·월 라벨 생성
            t('approvalPreview.submittedFmt', {
              date: new Intl.DateTimeFormat(locale, {
                month: 'long',
                day: 'numeric',
                timeZone: 'Asia/Seoul',
              }).format(new Date(iso)),
            })
          }
          emptyLabel={t('approvalPreview.empty')}
          loading={loading}
        />
      </HomeSection>

      {/* Lists — 기존 유지 */}
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
              href: `/onboarding/${item.recordId}`,
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
              href: `/offboarding/${item.recordId}`,
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

      {/* Conditional insight — 기존 유지 */}
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
