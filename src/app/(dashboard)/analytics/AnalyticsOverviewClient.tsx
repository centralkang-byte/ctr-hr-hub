'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Analytics Overview Client
// 전사 KPI 6개 + 서브 대시보드 네비게이션
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import {
  Users,
  UserPlus,
  UserMinus,
  TrendingDown,
  Clock,
  AlertTriangle,
  BarChart3,
  Target,
  Briefcase,
  Banknote,
  Heart,
  FileText,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { apiClient } from '@/lib/api'
import { AnalyticsPageLayout } from '@/components/analytics/AnalyticsPageLayout'
import { AnalyticsKpiCard } from '@/components/analytics/AnalyticsKpiCard'
import { EmptyState } from '@/components/ui/EmptyState'

interface OverviewKpi {
  totalHeadcount: number
  newHires30d: number
  resignations30d: number
  turnoverRateAnnualized: number
  avgOvertimeHours: number
  burnoutRiskCount: number
}

// ─── Component ──────────────────────────────────────────

export default function AnalyticsOverviewClient() {
  const searchParams = useSearchParams()
  const companyId = searchParams.get('company_id') ?? undefined
  const t = useTranslations('analytics')

  const [kpi, setKpi] = useState<OverviewKpi | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const timerRef = useRef<NodeJS.Timeout>()

  // ─── Sub-dashboard navigation config ────────────────────
  const SUB_DASHBOARDS = [
    { href: '/analytics/workforce', icon: Users, title: t('subDashboards.workforce'), description: t('subDashboards.workforceDesc') },
    { href: '/analytics/turnover', icon: TrendingDown, title: t('subDashboards.turnover'), description: t('subDashboards.turnoverDesc') },
    { href: '/analytics/performance', icon: Target, title: t('subDashboards.performance'), description: t('subDashboards.performanceDesc') },
    { href: '/analytics/attendance', icon: Clock, title: t('subDashboards.attendance'), description: t('subDashboards.attendanceDesc') },
    { href: '/analytics/recruitment', icon: Briefcase, title: t('subDashboards.recruitment'), description: t('subDashboards.recruitmentDesc') },
    { href: '/analytics/compensation', icon: Banknote, title: t('subDashboards.compensation'), description: t('subDashboards.compensationDesc') },
    { href: '/analytics/team-health', icon: Heart, title: t('subDashboards.teamHealth'), description: t('subDashboards.teamHealthDesc') },
    { href: '/analytics/report', icon: FileText, title: t('subDashboards.report'), description: t('subDashboards.reportDesc') },
  ]

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(false)
    setTimedOut(false)
    try {
      const res = await apiClient.get<OverviewKpi>('/api/v1/analytics/overview', {
        company_id: companyId,
      })
      setKpi(res.data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Art.27: Loading timeout fallback (5s)
  useEffect(() => {
    if (loading) {
      timerRef.current = setTimeout(() => setTimedOut(true), 5000)
    } else {
      clearTimeout(timerRef.current)
    }
    return () => clearTimeout(timerRef.current)
  }, [loading])

  return (
    <AnalyticsPageLayout
      title={t('title')}
      description={t('hrAnalyticsDescription')}
    >
      {/* KPI Cards */}
      {loading && !timedOut ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#999]" />
        </div>
      ) : timedOut && loading ? (
        <EmptyState
          icon={BarChart3}
          title={t('dataLoadFailed')}
          description={t('dataLoadFailed')}
          action={{ label: t('kr_kec8388eb'), onClick: () => fetchData() }}
        />
      ) : error ? (
        <EmptyState
          icon={AlertTriangle}
          title={t('dataLoadFailed')}
          description={t('dataLoadFailed')}
          action={{ label: t('retry'), onClick: () => fetchData() }}
        />
      ) : kpi ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
            <AnalyticsKpiCard
              label={t('totalEmployees')}
              value={kpi.totalHeadcount.toLocaleString()}
              icon={Users}
              suffix={t('personSuffix')}
              color="info"
            />
            <AnalyticsKpiCard
              label={t('newHires30d')}
              value={kpi.newHires30d}
              icon={UserPlus}
              suffix={t('personSuffix')}
              color="success"
            />
            <AnalyticsKpiCard
              label={t('resignations30d')}
              value={kpi.resignations30d}
              icon={UserMinus}
              suffix={t('personSuffix')}
              color="danger"
            />
            <AnalyticsKpiCard
              label={t('turnoverRateAnnualized')}
              value={kpi.turnoverRateAnnualized}
              icon={TrendingDown}
              suffix="%"
              color={kpi.turnoverRateAnnualized > 15 ? 'danger' : 'warning'}
            />
            <AnalyticsKpiCard
              label={t('avgOvertimeMonthly')}
              value={kpi.avgOvertimeHours}
              icon={Clock}
              suffix={t('hoursSuffix')}
              color={kpi.avgOvertimeHours > 10 ? 'warning' : 'default'}
            />
            <AnalyticsKpiCard
              label={t('burnoutRiskCount')}
              value={kpi.burnoutRiskCount}
              icon={AlertTriangle}
              suffix={t('personSuffix')}
              color={kpi.burnoutRiskCount > 0 ? 'danger' : 'success'}
            />
          </div>

          {/* Sub-dashboard Navigation */}
          <div>
            <h2 className="mb-4 text-lg font-semibold text-[#1A1A1A]">{t('detailedAnalysis')}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {SUB_DASHBOARDS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href + (companyId ? `?company_id=${companyId}` : '')}
                  className="group flex items-start gap-4 rounded-xl border border-[#E8E8E8] bg-white p-5 transition-all hover:border-[#EDF1FE] "
                >
                  <div className="rounded-lg bg-[#EDF1FE] p-2.5 text-[#5E81F4] transition-colors group-hover:bg-[#EDF1FE]">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-[#1A1A1A]">{item.title}</h3>
                    <p className="mt-0.5 text-xs text-[#666]">{item.description}</p>
                  </div>
                  <BarChart3 className="h-4 w-4 shrink-0 text-[#D4D4D4] transition-colors group-hover:text-[#5E81F4]" />
                </Link>
              ))}
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          icon={BarChart3}
          title="데이터가 아직 없습니다"
          description="인사 데이터가 충분히 쌓이면 HR Analytics가 자동으로 생성됩니다."
        />
      )}
    </AnalyticsPageLayout>
  )
}
