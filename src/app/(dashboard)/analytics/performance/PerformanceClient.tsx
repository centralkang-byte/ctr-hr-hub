'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Performance Analytics Client
// 성과 분석 (EMS분포/부서비교)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { apiClient } from '@/lib/api'
import { AnalyticsPageLayout } from '@/components/analytics/AnalyticsPageLayout'
import { ChartCard } from '@/components/analytics/ChartCard'
import { EmptyChart } from '@/components/analytics/EmptyChart'
import type { PerformanceData } from '@/lib/analytics/types'

// EMS 9-block labels
const EMS_LABELS: Record<string, string> = {
  '1': '1 (Low-Low)', '2': '2 (Low-Mid)', '3': '3 (Low-High)',
  '4': '4 (Mid-Low)', '5': '5 (Mid-Mid)', '6': '6 (Mid-High)',
  '7': '7 (High-Low)', '8': '8 (High-Mid)', '9': '9 (High-High)',
}

const EMS_COLORS: Record<string, string> = {
  '1': '#EF4444', '2': '#F97316', '3': '#F59E0B',
  '4': '#F97316', '5': '#10B981', '6': '#2563EB',
  '7': '#F59E0B', '8': '#2563EB', '9': '#6366F1',
}

export default function PerformanceClient() {
  const searchParams = useSearchParams()
  const companyId = searchParams.get('company_id') ?? undefined

  const [data, setData] = useState<PerformanceData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<PerformanceData>('/api/v1/analytics/performance', {
        company_id: companyId,
      })
      setData(res.data)
    } catch {
      // silently handle
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) {
    return (
      <AnalyticsPageLayout title="성과 분석">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </AnalyticsPageLayout>
    )
  }

  if (!data) {
    return (
      <AnalyticsPageLayout title="성과 분석">
        <EmptyChart />
      </AnalyticsPageLayout>
    )
  }

  // Process EMS data for the 9-block heatmap grid
  const emsData = data.emsDistribution.map((r) => ({
    ...r,
    label: EMS_LABELS[r.ems_block] ?? `Block ${r.ems_block}`,
    fill: EMS_COLORS[r.ems_block] ?? '#94A3B8',
  }))

  return (
    <AnalyticsPageLayout title="성과 분석" description="EMS 9-block 분포, 부서별 성과 점수 비교">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* EMS 9-block 히트맵 */}
        <ChartCard title="EMS 9-Block 분포" description="성과 vs 역량 그리드" className="lg:col-span-2">
          {emsData.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {/* Row 3 (High performance) */}
              {['7', '8', '9'].map((block) => {
                const item = emsData.find((e) => e.ems_block === block)
                return (
                  <div
                    key={block}
                    className="flex flex-col items-center justify-center rounded-lg border p-4"
                    style={{ backgroundColor: `${EMS_COLORS[block]}15`, borderColor: `${EMS_COLORS[block]}40` }}
                  >
                    <span className="text-xs font-medium text-slate-500">{EMS_LABELS[block]}</span>
                    <span className="mt-1 text-2xl font-bold" style={{ color: EMS_COLORS[block] }}>
                      {item?.employee_count ?? 0}
                    </span>
                    <span className="text-xs text-slate-400">명</span>
                  </div>
                )
              })}
              {/* Row 2 (Mid performance) */}
              {['4', '5', '6'].map((block) => {
                const item = emsData.find((e) => e.ems_block === block)
                return (
                  <div
                    key={block}
                    className="flex flex-col items-center justify-center rounded-lg border p-4"
                    style={{ backgroundColor: `${EMS_COLORS[block]}15`, borderColor: `${EMS_COLORS[block]}40` }}
                  >
                    <span className="text-xs font-medium text-slate-500">{EMS_LABELS[block]}</span>
                    <span className="mt-1 text-2xl font-bold" style={{ color: EMS_COLORS[block] }}>
                      {item?.employee_count ?? 0}
                    </span>
                    <span className="text-xs text-slate-400">명</span>
                  </div>
                )
              })}
              {/* Row 1 (Low performance) */}
              {['1', '2', '3'].map((block) => {
                const item = emsData.find((e) => e.ems_block === block)
                return (
                  <div
                    key={block}
                    className="flex flex-col items-center justify-center rounded-lg border p-4"
                    style={{ backgroundColor: `${EMS_COLORS[block]}15`, borderColor: `${EMS_COLORS[block]}40` }}
                  >
                    <span className="text-xs font-medium text-slate-500">{EMS_LABELS[block]}</span>
                    <span className="mt-1 text-2xl font-bold" style={{ color: EMS_COLORS[block] }}>
                      {item?.employee_count ?? 0}
                    </span>
                    <span className="text-xs text-slate-400">명</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyChart message="성과평가 데이터가 없습니다." />
          )}
        </ChartCard>

        {/* 부서별 평균 성과점수 */}
        <ChartCard title="부서별 평균 성과 점수" className="lg:col-span-2">
          {data.byDepartment.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={data.byDepartment}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="department_name" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 5]} />
                <Tooltip />
                <Bar dataKey="avg_score" fill="#6366F1" radius={[4, 4, 0, 0]} name="평균 점수" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>
      </div>
    </AnalyticsPageLayout>
  )
}
