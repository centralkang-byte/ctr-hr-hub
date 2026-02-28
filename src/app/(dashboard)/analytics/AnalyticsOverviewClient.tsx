'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Analytics Overview Client
// 전사 KPI 6개 + 서브 대시보드 네비게이션
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
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
} from 'lucide-react'
import { apiClient } from '@/lib/api'
import { AnalyticsPageLayout } from '@/components/analytics/AnalyticsPageLayout'
import { AnalyticsKpiCard } from '@/components/analytics/AnalyticsKpiCard'
import type { OverviewKpi } from '@/lib/analytics/types'

// ─── Sub-dashboard navigation config ────────────────────

const SUB_DASHBOARDS = [
  { href: '/analytics/workforce', icon: Users, title: '인력 분석', description: '부서별 인원, 고용형태, 직급 분포' },
  { href: '/analytics/turnover', icon: TrendingDown, title: '이직 분석', description: '월별 퇴사 트렌드, 사유, 부서별 이직률' },
  { href: '/analytics/performance', icon: Target, title: '성과 분석', description: 'EMS 9-block 분포, 부서별 비교' },
  { href: '/analytics/attendance', icon: Clock, title: '근태 분석', description: '주별 근무시간, 초과근무, 52시간 위험' },
  { href: '/analytics/recruitment', icon: Briefcase, title: '채용 분석', description: '채용 퍼널, 전환율, AI 스크리닝' },
  { href: '/analytics/compensation', icon: Banknote, title: '보상 분석', description: 'Compa-ratio 분포, 급여 밴드 적합도' },
  { href: '/analytics/team-health', icon: Heart, title: '팀 건강', description: '부서별 종합 점수, 번아웃 위험' },
  { href: '/analytics/report', icon: FileText, title: 'AI 보고서', description: 'AI 경영진 보고서 자동 생성' },
]

// ─── Component ──────────────────────────────────────────

export default function AnalyticsOverviewClient() {
  const searchParams = useSearchParams()
  const companyId = searchParams.get('company_id') ?? undefined

  const [kpi, setKpi] = useState<OverviewKpi | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<OverviewKpi>('/api/v1/analytics/overview', {
        company_id: companyId,
      })
      setKpi(res.data)
    } catch {
      // silently handle
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <AnalyticsPageLayout
      title="HR Analytics"
      description="전사 인사 데이터 분석 대시보드"
    >
      {/* KPI Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : kpi ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
            <AnalyticsKpiCard
              label="전체 인원"
              value={kpi.totalHeadcount.toLocaleString()}
              icon={Users}
              suffix="명"
              color="info"
            />
            <AnalyticsKpiCard
              label="신규 입사 (30일)"
              value={kpi.newHires30d}
              icon={UserPlus}
              suffix="명"
              color="success"
            />
            <AnalyticsKpiCard
              label="퇴사자 (30일)"
              value={kpi.resignations30d}
              icon={UserMinus}
              suffix="명"
              color="danger"
            />
            <AnalyticsKpiCard
              label="이직률 (연환산)"
              value={kpi.turnoverRateAnnualized}
              icon={TrendingDown}
              suffix="%"
              color={kpi.turnoverRateAnnualized > 15 ? 'danger' : 'warning'}
            />
            <AnalyticsKpiCard
              label="월평균 초과근무"
              value={kpi.avgOvertimeHours}
              icon={Clock}
              suffix="시간"
              color={kpi.avgOvertimeHours > 10 ? 'warning' : 'default'}
            />
            <AnalyticsKpiCard
              label="번아웃 위험"
              value={kpi.burnoutRiskCount}
              icon={AlertTriangle}
              suffix="명"
              color={kpi.burnoutRiskCount > 0 ? 'danger' : 'success'}
            />
          </div>

          {/* Sub-dashboard Navigation */}
          <div>
            <h2 className="mb-4 text-lg font-semibold text-slate-900">상세 분석</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {SUB_DASHBOARDS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href + (companyId ? `?company_id=${companyId}` : '')}
                  className="group flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-blue-300 hover:shadow-md"
                >
                  <div className="rounded-lg bg-blue-50 p-2.5 text-blue-600 transition-colors group-hover:bg-blue-100">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
                    <p className="mt-0.5 text-xs text-slate-500">{item.description}</p>
                  </div>
                  <BarChart3 className="h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-blue-400" />
                </Link>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="py-20 text-center text-sm text-slate-500">
          데이터를 불러오지 못했습니다.
        </div>
      )}
    </AnalyticsPageLayout>
  )
}
