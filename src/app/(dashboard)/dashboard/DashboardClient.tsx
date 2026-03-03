'use client'

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

const TABS: { key: Tab; label: string }[] = [
  { key: 'summary', label: '요약' },
  { key: 'workforce', label: '인력' },
  { key: 'recruit', label: '채용' },
  { key: 'performance', label: '성과' },
  { key: 'attendance', label: '근태' },
  { key: 'payroll', label: '급여' },
  { key: 'training', label: '교육' },
]

export function DashboardClient({ user, companies, defaultCompanyId }: DashboardClientProps) {
  const router = useRouter()
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
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">HR KPI 대시보드</h1>
          <p className="text-sm text-[#666] mt-1">조직 건강도 핵심 지표</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard/compare')}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-[#D4D4D4] rounded-lg hover:bg-[#FAFAFA] text-[#555]"
          >
            <Globe className="w-4 h-4" />
            글로벌 비교
          </button>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-3 py-2 text-sm border border-[#D4D4D4] rounded-lg"
          >
            {[2025, 2026].map((y) => (
              <option key={y} value={y}>
                {y}년
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
              {isSuperAdmin && <option value="all">전체 법인</option>}
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
              label="총 인원"
              value={summary?.headcount?.count ?? null}
              unit="명"
              change={summary?.headcount?.change ?? null}
              changeLabel="전월"
              onClick={() => router.push('/employees')}
            />
            <KpiSummaryCard
              label="이직률"
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
              label="채용 진행"
              value={summary?.openPositions?.count ?? null}
              unit="건"
              changeLabel={
                summary?.openPositions?.avgDays
                  ? `평균 ${summary.openPositions.avgDays}일`
                  : undefined
              }
              onClick={() => router.push('/recruitment')}
            />
            <KpiSummaryCard
              label="이직 위험"
              value={summary?.attritionRisk?.count ?? null}
              unit="명"
              changeLabel={
                summary?.attritionRisk
                  ? `위험 ${summary.attritionRisk.high} / 심각 ${summary.attritionRisk.critical}`
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
              label="연차 사용률"
              value={summary?.leaveUsage?.rate ?? null}
              unit="%"
              onClick={() => router.push('/leave')}
            />
            <KpiSummaryCard
              label="교육 이수율"
              value={summary?.trainingCompletion?.rate ?? null}
              unit="%"
              changeLabel={
                summary?.trainingCompletion
                  ? `${summary.trainingCompletion.completed}/${summary.trainingCompletion.total}명`
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
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'border-b-2 border-[#00C853] text-[#00C853]'
                : 'text-[#666] hover:text-[#333]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 탭별 위젯 그리드 — Lazy Mount */}
      {activeTab === 'workforce' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <KpiWidget
            title="직급별 인원 분포"
            widgetId="workforce-grade"
            {...widgetProps}
            chartType="bar-horizontal"
            nameKey="grade"
            dataKey="count"
            drilldownPath="/employees"
          />
          <KpiWidget
            title="법인별 인원 분포"
            widgetId="workforce-company"
            {...widgetProps}
            chartType="donut"
            nameKey="company"
            dataKey="count"
            drilldownPath="/org"
          />
          <KpiWidget
            title="입퇴사 추이 (12개월)"
            widgetId="workforce-trend"
            {...widgetProps}
            chartType="line"
            nameKey="month"
            dataKey="count"
            drilldownPath="/employees"
            height={220}
          />
          <KpiWidget
            title="근속 분포"
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
            title="채용 파이프라인"
            widgetId="recruit-pipeline"
            {...widgetProps}
            chartType="bar"
            nameKey="stage"
            dataKey="count"
            drilldownPath="/recruitment"
          />
          <KpiWidget
            title="평균 충원 소요일 (법인별)"
            widgetId="recruit-ttr"
            {...widgetProps}
            chartType="bar"
            nameKey="company"
            dataKey="avgDays"
            drilldownPath="/recruitment"
          />
          <KpiWidget
            title="Talent Pool 현황"
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
            title="평가 등급 분포"
            widgetId="perf-grade"
            {...widgetProps}
            chartType="bar"
            nameKey="grade"
            dataKey="count"
            drilldownPath="/performance"
          />
          <KpiWidget
            title="스킬 갭 Top 5"
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
            title="52시간 경고 현황"
            widgetId="attend-52h"
            {...widgetProps}
            chartType="bar"
            nameKey="level"
            dataKey="count"
            drilldownPath="/attendance/admin"
          />
          <KpiWidget
            title="연차 사용 추이 (12개월)"
            widgetId="attend-leave-trend"
            {...widgetProps}
            chartType="line"
            nameKey="month"
            dataKey="count"
            drilldownPath="/leave"
            height={220}
          />
          <KpiWidget
            title="번아웃 위험 분포"
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
            title="법인별 인건비 (백만 KRW)"
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
            title="법정교육 이수현황"
            widgetId="training-mandatory"
            {...widgetProps}
            chartType="bar"
            nameKey="courseTitle"
            dataKey="rate"
            drilldownPath="/training"
          />
          <KpiWidget
            title="복리후생 활용률"
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
