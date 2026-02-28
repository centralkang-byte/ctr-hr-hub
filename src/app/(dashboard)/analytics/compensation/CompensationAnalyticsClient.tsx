'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Compensation Analytics Client
// 보상 분석 (compa-ratio분포/직급별)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { apiClient } from '@/lib/api'
import { AnalyticsPageLayout } from '@/components/analytics/AnalyticsPageLayout'
import { ChartCard } from '@/components/analytics/ChartCard'
import { EmptyChart } from '@/components/analytics/EmptyChart'
import { AnalyticsKpiCard } from '@/components/analytics/AnalyticsKpiCard'
import type { CompensationData } from '@/lib/analytics/types'
import { Banknote } from 'lucide-react'

const BAND_COLORS = ['#EF4444', '#10B981', '#F59E0B']

export default function CompensationAnalyticsClient() {
  const searchParams = useSearchParams()
  const companyId = searchParams.get('company_id') ?? undefined

  const [data, setData] = useState<CompensationData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<CompensationData>('/api/v1/analytics/compensation', {
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
      <AnalyticsPageLayout title="보상 분석">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </AnalyticsPageLayout>
    )
  }

  if (!data) {
    return (
      <AnalyticsPageLayout title="보상 분석">
        <EmptyChart />
      </AnalyticsPageLayout>
    )
  }

  const total = data.bandFit.under + data.bandFit.in_band + data.bandFit.over
  const bandPieData = [
    { name: 'Under Band', value: data.bandFit.under },
    { name: 'In Band', value: data.bandFit.in_band },
    { name: 'Over Band', value: data.bandFit.over },
  ]

  return (
    <AnalyticsPageLayout title="보상 분석" description="Compa-ratio 분포, 직급별 보상 비교, 밴드 적합도">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <AnalyticsKpiCard
          label="Under Band"
          value={total > 0 ? `${Math.round((data.bandFit.under / total) * 100)}%` : '-'}
          icon={Banknote}
          color="danger"
        />
        <AnalyticsKpiCard
          label="In Band"
          value={total > 0 ? `${Math.round((data.bandFit.in_band / total) * 100)}%` : '-'}
          icon={Banknote}
          color="success"
        />
        <AnalyticsKpiCard
          label="Over Band"
          value={total > 0 ? `${Math.round((data.bandFit.over / total) * 100)}%` : '-'}
          icon={Banknote}
          color="warning"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 직급별 평균 Compa-Ratio */}
        <ChartCard title="직급별 평균 Compa-Ratio">
          {data.byGrade.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.byGrade}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="grade_name" tick={{ fontSize: 12 }} />
                <YAxis domain={[0.5, 1.5]} />
                <Tooltip formatter={(v) => typeof v === 'number' ? v.toFixed(3) : v} />
                <Bar dataKey="avg_compa_ratio" fill="#6366F1" radius={[4, 4, 0, 0]} name="Compa-Ratio" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>

        {/* 밴드 적합도 분포 */}
        <ChartCard title="급여 밴드 적합도">
          {total > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={bandPieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {bandPieData.map((_, i) => (
                    <Cell key={i} fill={BAND_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>

        {/* Compa-Ratio 상세 테이블 */}
        <ChartCard title="직급/직군별 Compa-Ratio 상세" className="lg:col-span-2">
          {data.distribution.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">직급</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">직군</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">인원</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">평균</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">P25</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">중간값</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">P75</th>
                  </tr>
                </thead>
                <tbody>
                  {data.distribution.map((r, i) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-700">{r.grade_name}</td>
                      <td className="px-4 py-3 text-slate-600">{r.job_category_code}</td>
                      <td className="px-4 py-3 text-center text-slate-600">{r.employee_count}</td>
                      <td className="px-4 py-3 text-center text-slate-600">{r.avg_compa_ratio?.toFixed(3) ?? '-'}</td>
                      <td className="px-4 py-3 text-center text-slate-600">{r.p25?.toFixed(3) ?? '-'}</td>
                      <td className="px-4 py-3 text-center text-slate-600">{r.median?.toFixed(3) ?? '-'}</td>
                      <td className="px-4 py-3 text-center text-slate-600">{r.p75?.toFixed(3) ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>
      </div>
    </AnalyticsPageLayout>
  )
}
