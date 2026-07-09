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
  ClipboardList,
  Target as TargetIcon,
  Wallet,
  Building2,
  BarChart3,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { DashboardHomeShell, HomeGrid, HomeSection } from './shell/DashboardHomeShell'
import { WorkdayHero } from './primitives/WorkdayHero'
import { WorkletGrid, type WorkletTile } from './primitives/WorkletGrid'
import { ApprovalPreview } from './primitives/ApprovalPreview'
import { QuickActionsRow, type QuickAction } from './primitives/QuickActionsRow'
import { SuggestCard, type SuggestTone } from './primitives/SuggestCard'
import { RecentNotificationsCard } from './primitives/RecentNotificationsCard'
import { ListCard } from './primitives/ListCard'
import { EmptyState } from './primitives/EmptyState'
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

  // ── Quick actions (proto wd-quick-row) ─────────────────
  // Codex G1 P1-6: 직접 생성 URL이 있는 곳만 액션 라벨(/employees/new·/recruitment/new),
  // 없는 곳은 "관리" 라벨로 강등 (payroll·onboarding)
  const quickActions: QuickAction[] = [
    { id: 'employee-new', icon: UserPlus, label: t('quick.employeeNew'), href: '/employees/new' },
    { id: 'payroll', icon: Wallet, label: t('quick.payroll'), href: '/payroll' },
    { id: 'analytics', icon: BarChart3, label: t('quick.analytics'), href: '/dashboard' },
    { id: 'job-new', icon: Briefcase, label: t('quick.jobNew'), href: '/recruitment/new' },
    { id: 'onboarding', icon: ClipboardList, label: t('quick.onboarding'), href: '/onboarding' },
  ]

  // ── Worklet tiles (proto SSOT 1-8) ─────────────────────
  // subtitle / inline 데이터는 summary derive — payroll/organization 은 i18n 정적 (PR-5C 동적화 후보)
  // Wave 1: tone = proto --wt 매핑 (직원1·근태2·채용3·휴가4·성과5·급여6·조직7·분석8)
  const workletTiles: WorkletTile[] = [
    {
      id: 'employees',
      icon: Users,
      tone: 'wt-1',
      title: t('worklet.employees.title'),
      subtitle: t('worklet.employees.subtitle', { total: totalEmployees, newHires }),
      href: '/employees',
    },
    {
      id: 'recruitment',
      icon: Briefcase,
      tone: 'wt-3',
      title: t('worklet.recruitment.title'),
      subtitle: t('worklet.recruitment.subtitle', { open: openPositions }),
      href: '/recruitment',
      count: openPositions > 0 ? openPositions : undefined,
    },
    {
      id: 'attendance',
      icon: Clock,
      tone: 'wt-2',
      title: t('worklet.attendance.title'),
      subtitle: attendanceToday
        ? t('worklet.attendance.subtitle', {
            present: attendanceToday.present,
            late: attendanceToday.late,
          })
        : t('worklet.attendance.subtitleEmpty'),
      href: '/attendance',
    },
    {
      id: 'leave',
      icon: CalendarDays,
      tone: 'wt-4',
      title: t('worklet.leave.title'),
      subtitle: t('worklet.leave.subtitle', { pending: pendingLeaves }),
      href: '/leave',
      count: pendingLeaves > 0 ? pendingLeaves : undefined,
    },
    {
      id: 'performance',
      icon: TargetIcon,
      tone: 'wt-5',
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
      tone: 'wt-6',
      title: t('worklet.payroll.title'),
      subtitle: t('worklet.payroll.subtitle'),
      href: '/payroll',
    },
    {
      id: 'organization',
      icon: Building2,
      tone: 'wt-7',
      title: t('worklet.organization.title'),
      subtitle: t('worklet.organization.subtitle'),
      href: '/organization',
    },
    {
      id: 'analytics',
      icon: BarChart3,
      tone: 'wt-8',
      title: t('worklet.analytics.title'),
      subtitle: t('worklet.analytics.subtitle', { rate: turnoverRate }),
      href: '/dashboard',
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

  // ── Suggest cards (proto wd-suggest) ──────────────────
  // 실데이터 조건이 참인 카드만 (Codex G1 P1-5: deadline 없는 MBO는 "미완료 현황"으로 한정)
  const reviewStats = summary?.quarterlyReviewStats
  const mboPending = reviewStats?.pending ?? 0
  const suggestCards = [
    ...(urgentCount > 0
      ? [
          {
            id: 'urgent',
            icon: AlertCircle,
            tone: 'wt-1' as SuggestTone,
            title: t('suggest.urgentTitle', { count: urgentCount }),
            description: t('suggest.urgentDesc'),
            cta: t('suggest.urgentCta'),
            href: '/approvals/inbox',
          },
        ]
      : []),
    ...(newHires > 0 && onboardingCount === 0
      ? [
          {
            id: 'orphan-hires',
            icon: UserPlus,
            tone: 'wt-2' as SuggestTone,
            title: t('suggest.orphanTitle', { count: newHires }),
            description: t('suggest.orphanDesc'),
            cta: t('suggest.orphanCta'),
            href: '/onboarding',
          },
        ]
      : []),
    ...(reviewStats && mboPending > 0
      ? [
          {
            id: 'mbo-pending',
            icon: TargetIcon,
            tone: 'wt-4' as SuggestTone,
            title: t('suggest.mboTitle', { count: mboPending }),
            description: t('suggest.mboDesc', {
              rate: reviewStats.completionRate ?? 0,
              completed: reviewStats.completed ?? 0,
              total: reviewStats.total ?? 0,
            }),
            cta: t('suggest.mboCta'),
            href: '/performance',
          },
        ]
      : []),
  ]

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

      {/* 빠른 작업 — proto wd-quick-row (Wave 1 복원; StatCard 행은 proto 부재+히어로 KPI 중복으로 제거) */}
      <HomeSection title={t('section.quickActions')} srOnly>
        <QuickActionsRow ariaLabel={t('section.quickActions')} actions={quickActions} />
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

      {/* 권장 작업 — proto wd-suggest-grid (실데이터 조건 카드만) */}
      {suggestCards.length > 0 ? (
        <HomeSection title={t('suggest.heading')}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {suggestCards.map((card) => (
              <SuggestCard
                key={card.id}
                icon={card.icon}
                tone={card.tone}
                title={card.title}
                description={card.description}
                cta={card.cta}
                href={card.href}
              />
            ))}
          </div>
        </HomeSection>
      ) : null}

      {/* 최근 알림 + 온보딩/오프보딩 — proto grid-2 (Codex G1 P2-12: 3카드 2+1 wrap, 오프보딩 half-width) */}
      <HomeSection title={t('section.list')} srOnly>
        <HomeGrid cols={2}>
          <RecentNotificationsCard
            heading={t('notif.heading')}
            viewAllHref="/notifications"
            viewAllLabel={t('notif.viewAll')}
            emptyLabel={t('notif.empty')}
            errorLabel={t('notif.error')}
            retryLabel={t('notif.retry')}
            unreadLabel={t('notif.unread')}
            dateFormatter={(iso) =>
              new Intl.DateTimeFormat(locale, {
                month: 'short',
                day: 'numeric',
                timeZone: 'Asia/Seoul',
              }).format(new Date(iso))
            }
          />
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
