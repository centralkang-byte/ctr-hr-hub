'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Executive Home (V3 2-Zone)
// Phase 4 Batch 7: Action Zone + Monitor Zone 전면 재구축.
// Real data only. AI insights / 단일 task / mock KPI는 Phase 6에서 도입.
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import {
  TrendingUp,
  Building2,
  BarChart3,
  Users,
} from 'lucide-react'
import { DashboardTaskList } from './DashboardTaskList'
import { DashboardErrorBanner } from './DashboardErrorBanner'
import { PlaceholderCard } from './PlaceholderCard'
import { WidgetSkeleton } from '@/components/shared/WidgetSkeleton'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { SessionUser, ExecSummary } from '@/types'

// ─── Types ────────────────────────────────────────────────

interface Props {
  user: SessionUser
}

// ─── Helpers ──────────────────────────────────────────────

function ActionKpiCard({
  label,
  value,
  color = 'primary',
}: {
  label: string
  value: string | number
  color?: 'primary' | 'error' | 'alert' | 'warning-bright' | 'success'
}) {
  // D17/D18: text는 WCAG AA-safe, bg tint로 시각 강조
  const textMap: Record<string, string> = {
    primary: 'text-primary',
    error: 'text-error',
    alert: 'text-error',
    'warning-bright': 'text-[#B45309]',
    success: 'text-tertiary',
  }
  const bgMap: Record<string, string> = {
    primary: 'bg-muted/50',
    error: 'bg-muted/50',
    alert: 'bg-alert-red/10',
    'warning-bright': 'bg-warning-bright/15',
    success: 'bg-muted/50',
  }
  return (
    <div
      aria-label={`${label}: ${value}`}
      className={cn('flex flex-col justify-center rounded-lg p-4 text-center', bgMap[color])}
    >
      <p
        className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground"
        aria-hidden="true"
      >
        {label}
      </p>
      <p
        className={cn(
          'mt-1 font-display text-2xl font-extrabold tabular-nums',
          textMap[color],
        )}
        aria-hidden="true"
      >
        {value}
      </p>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────

export function ExecutiveHome({ user }: Props) {
  const t = useTranslations('home')
  const [summary, setSummary] = useState<ExecSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchSummary = useCallback(async () => {
    setError(false)
    setLoading(true)
    try {
      const res = await apiClient.get<ExecSummary>('/api/v1/home/summary')
      setSummary(res.data)
    } catch {
      setError(true)
      toast({ title: '로드 실패', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchSummary()
  }, [fetchSummary])

  return (
    <div className="space-y-6">
      {/* ── Greeting ── */}
      <header>
        <h1
          id="dashboard-title"
          className="text-3xl font-bold text-foreground"
        >
          {t('executive.actionTitle', { name: user.name })}
        </h1>
        <p className="mt-1 text-base text-muted-foreground">
          {t('executive.greetingDesc')}
        </p>
      </header>

      {/* ── ACTION ZONE ── */}
      <section
        aria-label={t('actionZone')}
        className="rounded-2xl bg-card p-8 shadow-sm"
      >
        <div
          className="mb-4 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground"
          aria-hidden="true"
        >
          {t('actionZone')}
        </div>

        {error && (
          <DashboardErrorBanner
            message={t('loadError')}
            onRetry={() => void fetchSummary()}
          />
        )}

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:auto-rows-fr">
          {/* 좌: 실 결재 task list — summary와 독립적으로 렌더 (별도 endpoint) */}
          <DashboardTaskList user={user} />

          {/* 우: 2x2 Action KPI — 실데이터만 */}
          {loading ? (
            <WidgetSkeleton height="h-48" lines={4} />
          ) : (
            <div
              className="grid grid-cols-2 gap-3 content-stretch h-full"
              role="group"
              aria-label={t('executive.actionKpiGroup')}
            >
              <ActionKpiCard
                label={t('executive.actionKpi.orgSize')}
                value={summary?.totalEmployees?.toLocaleString() ?? '-'}
                color="primary"
              />
              <ActionKpiCard
                label={t('executive.actionKpi.turnoverRate')}
                value={
                  summary?.turnoverRate != null
                    ? `${summary.turnoverRate.toFixed(1)}%`
                    : '-'
                }
                color="error"
              />
              <ActionKpiCard
                label={t('hrAdmin.newHires')}
                value={summary?.newHires ?? '-'}
                color="success"
              />
              <ActionKpiCard
                label={t('hrAdmin.openPositions')}
                value={summary?.openPositions ?? '-'}
                color="warning-bright"
              />
            </div>
          )}
        </div>
      </section>

      {/* ── MONITOR ZONE ── */}
      <section aria-label={t('monitorZone')} className="space-y-6">
        <div
          className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground"
          aria-hidden="true"
        >
          {t('monitorZone')}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <PlaceholderCard
            title={t('executive.companyOverview')}
            icon={Building2}
          />
          <PlaceholderCard
            title={t('executive.laborCostTrend')}
            icon={TrendingUp}
          />
          <PlaceholderCard
            title={t('executive.quarterlySummary')}
            icon={BarChart3}
          />
          <PlaceholderCard
            title={t('executive.successionPipeline')}
            icon={Users}
          />
        </div>
      </section>
    </div>
  )
}
