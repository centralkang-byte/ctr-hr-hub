'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'
import { KpiSummaryCard } from '@/components/dashboard/KpiSummaryCard'
import { KpiWidget } from '@/components/dashboard/KpiWidget'
import { WidgetSkeleton } from '@/components/dashboard/WidgetSkeleton'
import { Globe } from 'lucide-react'

type Tab = 'summary' | 'workforce' | 'recruit' | 'performance' | 'attendance' | 'payroll' | 'training'

interface Company {
  id: string
  code: string
  name: string
}

interface SummaryData {
  headcount: { count: number; prevCount: number | null; change: number | null } | null
  turnoverRate: { rate: number | null; change: number | null } | null
  openPositions: { count: number; avgDays: number | null } | null
  attritionRisk: { count: number; high: number; critical: number } | null
  leaveUsage: { rate: number | null } | null
  trainingCompletion: { rate: number | null; completed: number; total: number } | null
}

interface DashboardClientProps {
  user: SessionUser
  companies: Company[]
  defaultCompanyId: string | null
}

const TAB_KEYS: Tab[] = ['summary', 'workforce', 'recruit', 'performance', 'attendance', 'payroll', 'training']

export function DashboardClient({ user, companies, defaultCompanyId }: DashboardClientProps) {
  const router = useRouter()
  const t = useTranslations('home')
  const [activeTab, setActiveTab] = useState<Tab>('summary')
  const [companyId, setCompanyId] = useState<string | null>(defaultCompanyId)
  const [year, setYear] = useState(new Date().getFullYear())
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)

  const isSuperAdmin = user.role === ROLE.SUPER_ADMIN

  useEffect(() => {
    setSummaryLoading(true)
    const params = new URLSearchParams({ year: year.toString() })
    params.set('companyId', companyId ?? 'all')
    fetch(`/api/v1/dashboard/summary?${params}`)
      .then((r) => r.json())
      .then((json) => setSummary(json.data))
      .catch(() => setSummary(null))
      .finally(() => setSummaryLoading(false))
  }, [companyId, year])

  const widgetProps = { companyId, year }

  return (
    <div className="p-8 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">{t('kpiDashboardTitle')}</h1>
          <p className="text-sm text-[#666] mt-1">{t('kpiDashboardSubtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard/compare')}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-[#D4D4D4] rounded-lg hover:bg-[#FAFAFA] text-[#555]"
          >
            <Globe className="w-4 h-4" />
            {t('globalCompare')}
          </button>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-3 py-2 text-sm border border-[#D4D4D4] rounded-lg"
          >
            {[2025, 2026].map((y) => (
              <option key={y} value={y}>
                {y}{t('yearSuffix')}
              </option>
            ))}
          </select>
          {(isSuperAdmin || companies.length > 1) && (
            <select
              value={companyId ?? 'all'}
              onChange={(e) =>
                setCompanyId(e.target.value === 'all' ? null : e.target.value)
              }
              className="px-3 py-2 text-sm border border-[#D4D4D4] rounded-lg"
            >
              {isSuperAdmin && <option value="all">{t('allCompanies')}</option>}
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* 경영진 요약 KPI 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {summaryLoading ? (
          Array.from({ length: 6 }).map((_, i) => <WidgetSkeleton key={i} height="h-28" />)
        ) : (
          <>
            <KpiSummaryCard
              label={t('kpiHeadcount')}
              value={summary?.headcount?.count ?? null}
              unit={t('unitPerson')}
              change={summary?.headcount?.change ?? null}
              changeLabel={t('prevMonth')}
              onClick={() => router.push('/employees')}
            />
            <KpiSummaryCard
              label={t('kpiTurnoverRate')}
              value={summary?.turnoverRate?.rate ?? null}
              unit="%"
              status={
                (summary?.turnoverRate?.rate ?? 0) > 15
                  ? 'danger'
                  : (summary?.turnoverRate?.rate ?? 0) > 10
                  ? 'warning'
                  : 'default'
              }
              onClick={() => router.push('/analytics/turnover')}
            />
            <KpiSummaryCard
              label={t('kpiRecruitActive')}
              value={summary?.openPositions?.count ?? null}
              unit={t('unitCase')}
              changeLabel={
                summary?.openPositions?.avgDays
                  ? t('avgDays', { days: summary.openPositions.avgDays })
                  : undefined
              }
              onClick={() => router.push('/recruitment')}
            />
            <KpiSummaryCard
              label={t('kpiAttritionRisk')}
              value={summary?.attritionRisk?.count ?? null}
              unit={t('unitPerson')}
              changeLabel={
                summary?.attritionRisk
                  ? t('attritionBreakdown', { high: summary.attritionRisk.high, critical: summary.attritionRisk.critical })
                  : undefined
              }
              status={
                (summary?.attritionRisk?.count ?? 0) > 10
                  ? 'danger'
                  : (summary?.attritionRisk?.count ?? 0) > 5
                  ? 'warning'
                  : 'default'
              }
              onClick={() => router.push('/analytics/turnover')}
            />
            <KpiSummaryCard
              label={t('kpiLeaveUsage')}
              value={summary?.leaveUsage?.rate ?? null}
              unit="%"
              onClick={() => router.push('/leave')}
            />
            <KpiSummaryCard
              label={t('kpiTrainingCompletion')}
              value={summary?.trainingCompletion?.rate ?? null}
              unit="%"
              changeLabel={
                summary?.trainingCompletion
                  ? t('trainingBreakdown', { completed: summary.trainingCompletion.completed, total: summary.trainingCompletion.total })
                  : undefined
              }
              status={
                (summary?.trainingCompletion?.rate ?? 100) < 80 ? 'warning' : 'default'
              }
              onClick={() => router.push('/training')}
            />
          </>
        )}
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex border-b border-[#E8E8E8]">
        {TAB_KEYS.map((key) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === key
                ? 'border-b-2 border-[#5E81F4] text-[#5E81F4]'
                : 'text-[#666] hover:text-[#333]'
            }`}
          >
            {t(`tab.${key}`)}
          </button>
        ))}
      </div>

      {/* 탭별 위젯 그리드 — Lazy Mount */}
      {activeTab === 'workforce' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <KpiWidget
            title={t('widget.gradeDistribution')}
            widgetId="workforce-grade"
            {...widgetProps}
            chartType="bar-horizontal"
            nameKey="grade"
            dataKey="count"
            drilldownPath="/employees"
          />
          <KpiWidget
            title={t('widget.companyDistribution')}
            widgetId="workforce-company"
            {...widgetProps}
            chartType="donut"
            nameKey="company"
            dataKey="count"
            drilldownPath="/org"
          />
          <KpiWidget
            title={t('widget.hireTrend')}
            widgetId="workforce-trend"
            {...widgetProps}
            chartType="line"
            nameKey="month"
            dataKey="count"
            drilldownPath="/employees"
            height={220}
          />
          <KpiWidget
            title={t('widget.tenureDistribution')}
            widgetId="workforce-tenure"
            {...widgetProps}
            chartType="bar"
            nameKey="range"
            dataKey="count"
            drilldownPath="/employees"
          />
        </div>
      )}

      {activeTab === 'recruit' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <KpiWidget
            title={t('widget.recruitPipeline')}
            widgetId="recruit-pipeline"
            {...widgetProps}
            chartType="bar"
            nameKey="stage"
            dataKey="count"
            drilldownPath="/recruitment"
          />
          <KpiWidget
            title={t('widget.avgTimeToFill')}
            widgetId="recruit-ttr"
            {...widgetProps}
            chartType="bar"
            nameKey="company"
            dataKey="avgDays"
            drilldownPath="/recruitment"
          />
          <KpiWidget
            title={t('widget.talentPool')}
            widgetId="recruit-talent-pool"
            {...widgetProps}
            chartType="number"
            drilldownPath="/recruitment"
          />
        </div>
      )}

      {activeTab === 'performance' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <KpiWidget
            title={t('widget.performanceGrade')}
            widgetId="perf-grade"
            {...widgetProps}
            chartType="bar"
            nameKey="grade"
            dataKey="count"
            drilldownPath="/performance"
          />
          <KpiWidget
            title={t('widget.skillGapTop5')}
            widgetId="perf-skill-gap"
            {...widgetProps}
            chartType="bar-horizontal"
            nameKey="name"
            dataKey="avgGap"
            drilldownPath="/organization/skill-matrix"
          />
        </div>
      )}

      {activeTab === 'attendance' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <KpiWidget
            title={t('widget.overtime52h')}
            widgetId="attend-52h"
            {...widgetProps}
            chartType="bar"
            nameKey="level"
            dataKey="count"
            drilldownPath="/attendance/admin"
          />
          <KpiWidget
            title={t('widget.leaveTrend')}
            widgetId="attend-leave-trend"
            {...widgetProps}
            chartType="line"
            nameKey="month"
            dataKey="count"
            drilldownPath="/leave"
            height={220}
          />
          <KpiWidget
            title={t('widget.burnoutRisk')}
            widgetId="attend-burnout"
            {...widgetProps}
            chartType="bar"
            nameKey="level"
            dataKey="count"
            drilldownPath="/analytics/team-health"
          />
        </div>
      )}

      {activeTab === 'payroll' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <KpiWidget
            title={t('widget.payrollCost')}
            widgetId="payroll-cost"
            {...widgetProps}
            chartType="bar"
            nameKey="company"
            dataKey="totalKrw"
            drilldownPath="/payroll/global"
          />
        </div>
      )}

      {activeTab === 'training' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <KpiWidget
            title={t('widget.mandatoryTraining')}
            widgetId="training-mandatory"
            {...widgetProps}
            chartType="bar"
            nameKey="courseTitle"
            dataKey="rate"
            drilldownPath="/training"
          />
          <KpiWidget
            title={t('widget.benefitsUsage')}
            widgetId="training-benefit"
            {...widgetProps}
            chartType="bar"
            nameKey="category"
            dataKey="count"
            drilldownPath="/benefits"
          />
        </div>
      )}
    </div>
  )
}
