'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Executive Home V2 (R3 Dashboard Pilot)
// R1 primitive 기반 재구성: Hero + 4 StatCard + 1 ListCard (offboarding only) + 조건부 Insight.
// V1(ExecutiveHome.tsx)과 공존 — /home-preview/executive에서만 렌더.
// Codex Gate 1 MED: turnoverRate 5% 단독 트리거는 소규모 법인 noise → terminations >= 3 AND turnoverRate >= 5 복합 조건.
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import {
  TrendingUp,
  AlertTriangle,
  Sparkles,
} from 'lucide-react'
import { DashboardHomeShell, HomeGrid, HomeSection, HomeStack } from './shell/DashboardHomeShell'
import { HeroCard } from './primitives/HeroCard'
import { StatCard } from './primitives/StatCard'
import { ListCard } from './primitives/ListCard'
import { EmptyState } from './primitives/EmptyState'
import { InsightStrip } from './primitives/InsightStrip'
import { DashboardErrorBanner } from './DashboardErrorBanner'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import type { SessionUser, ExecSummary, HrAdminSummary, OnboardingItem } from '@/types'

// ─── Types ──────────────────────────────────────────────────

interface Props {
  user: SessionUser
}

/**
 * Executive branch shares the same API response as HR (without quarterlyReviewStats/onboarding).
 * We type against HrAdminSummary-like shape and read what applies — activeOffboarding is
 * sent by the API when the role is EXECUTIVE only if isExecutive flag didn't skip it.
 * Current API: EXECUTIVE skips activeOffboarding (returns empty []) — we just render empty state.
 */
type ExecSummaryWithLists = ExecSummary & Pick<HrAdminSummary, 'activeOffboarding'>

type HeroFocusKind = 'turnover' | 'openPositions' | 'newHires' | 'stable'

// ─── Helpers ────────────────────────────────────────────────

/**
 * Codex Gate 1 MED fix: turnoverRate 단독 5% 트리거 대신 복합 조건.
 * terminations >= 3 (최소 규모) + turnoverRate >= 5 (비율 임계) 동시 만족 시 warning.
 */
function pickHeroFocus(summary: ExecSummary | null): HeroFocusKind {
  if (!summary) return 'stable'
  const turnoverSignal = summary.terminations >= 3 && summary.turnoverRate >= 5 ? 1 : 0
  const openSignal = summary.openPositions >= 10 ? 1 : 0
  const newHiresSignal = summary.newHires > 0 ? 1 : 0

  const scores = {
    turnover: turnoverSignal * 3,
    openPositions: openSignal * 2,
    newHires: newHiresSignal * 1,
  }
  const max = Math.max(scores.turnover, scores.openPositions, scores.newHires)
  if (max <= 0) return 'stable'
  if (scores.turnover === max) return 'turnover'
  if (scores.openPositions === max) return 'openPositions'
  return 'newHires'
}

function listItemStatusForOffboarding(
  daysUntilStart: number | null | undefined,
): 'success' | 'warning' | 'error' {
  if (daysUntilStart == null) return 'warning'
  if (daysUntilStart < 0) return 'error'
  if (daysUntilStart <= 7) return 'warning'
  return 'success'
}

function timeOfDayIllustration(): 'sunrise' | 'focus' {
  return new Date().getHours() < 12 ? 'sunrise' : 'focus'
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

export function ExecutiveHomeV2({ user }: Props) {
  const t = useTranslations('home.executive.v2')
  const [summary, setSummary] = useState<ExecSummaryWithLists | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchSummary = useCallback(async () => {
    setError(false)
    setLoading(true)
    try {
      const res = await apiClient.get<ExecSummaryWithLists>('/api/v1/home/summary')
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
  const newHires = summary?.newHires ?? 0
  const terminations = summary?.terminations ?? 0
  const turnoverRate = summary?.turnoverRate ?? 0
  const openPositions = summary?.openPositions ?? 0

  const focusKind = pickHeroFocus(summary)
  const newHiresSpark = (summary?.newHiresTrend ?? []).map((p) => p.value)

  const activeOffboarding: OnboardingItem[] = summary?.activeOffboarding ?? []

  const highTurnover = terminations >= 3 && turnoverRate >= 5

  // Hero focus resolution
  const heroFocus = (() => {
    switch (focusKind) {
      case 'turnover':
        return {
          title: t('hero.focusTurnover', { rate: turnoverRate, count: terminations }),
          description: t('hero.focusTurnoverDesc'),
          cta: { label: t('hero.cta.analyze'), href: '/analytics/turnover' },
          illustration: 'focus' as const,
        }
      case 'openPositions':
        return {
          title: t('hero.focusOpenPositions', { count: openPositions }),
          description: t('hero.focusOpenPositionsDesc'),
          cta: { label: t('hero.cta.view'), href: '/analytics/recruitment' },
          illustration: 'focus' as const,
        }
      case 'newHires':
        return {
          title: t('hero.focusNewHires', { count: newHires }),
          description: t('hero.focusNewHiresDesc'),
          cta: { label: t('hero.cta.view'), href: '/analytics/workforce' },
          illustration: timeOfDayIllustration(),
        }
      default:
        return {
          title: t('hero.focusStable'),
          description: t('hero.focusStableDesc'),
          cta: { label: t('hero.cta.dashboard'), href: '/analytics' },
          illustration: 'celebration' as const,
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
            action={{ label: t('stat.viewWorkforce'), href: '/analytics/workforce' }}
          />
          <StatCard
            label={t('stat.newHires')}
            value={loading ? '—' : newHires}
            loading={loading}
            tone={newHires > 0 ? 'success' : 'default'}
            action={{ label: t('stat.viewEmployees'), href: '/directory' }}
          />
          <StatCard
            label={t('stat.turnoverRate')}
            value={loading ? '—' : `${turnoverRate}%`}
            loading={loading}
            tone={highTurnover ? 'warning' : 'default'}
            action={{ label: t('stat.viewTurnover'), href: '/analytics/turnover' }}
          />
          <StatCard
            label={t('stat.openPositions')}
            value={loading ? '—' : openPositions}
            loading={loading}
            tone="info"
            action={{ label: t('stat.viewRecruitment'), href: '/analytics/recruitment' }}
          />
        </HomeGrid>
      </HomeSection>

      {/* List (offboarding only — executive 관찰자 role) */}
      <HomeSection title={t('section.list')} srOnly>
        <HomeGrid cols={1}>
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
                icon={TrendingUp}
                title={t('empty.offboarding.title')}
                description={t('empty.offboarding.desc')}
                tone="success"
              />
            }
          />
        </HomeGrid>
      </HomeSection>

      {/* Conditional insight — high turnover only */}
      {highTurnover ? (
        <HomeSection title={t('section.insight')} srOnly>
          <HomeStack gap="sm">
            <InsightStrip
              kind="ai-suggestion"
              icon={Sparkles}
              message={t('insight.turnoverMsg', { rate: turnoverRate, count: terminations })}
              action={{ label: t('insight.turnoverCta'), href: '/analytics/turnover' }}
            />
          </HomeStack>
        </HomeSection>
      ) : null}

      {/* Non-critical "watch" insight — openPositions elevated but not critical */}
      {!highTurnover && openPositions >= 10 ? (
        <HomeSection title={t('section.insight')} srOnly>
          <HomeStack gap="sm">
            <InsightStrip
              kind="announcement"
              icon={AlertTriangle}
              message={t('insight.openPositionsMsg', { count: openPositions })}
              action={{ label: t('insight.openPositionsCta'), href: '/analytics/recruitment' }}
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
