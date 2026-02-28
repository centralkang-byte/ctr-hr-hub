'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Turnover Analytics Client
// 이직 분석 (월별 트렌드/사유/부서별)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ComposedChart,
} from 'recharts'
import { apiClient } from '@/lib/api'
import { AnalyticsPageLayout } from '@/components/analytics/AnalyticsPageLayout'
import { ChartCard } from '@/components/analytics/ChartCard'
import { EmptyChart } from '@/components/analytics/EmptyChart'
import type { TurnoverData } from '@/lib/analytics/types'

const COLORS = ['#2563EB', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4']

export default function TurnoverClient() {
  const searchParams = useSearchParams()
  const companyId = searchParams.get('company_id') ?? undefined

  const [data, setData] = useState<TurnoverData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<TurnoverData>('/api/v1/analytics/turnover', {
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
      <AnalyticsPageLayout title="이직 분석">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </AnalyticsPageLayout>
    )
  }

  if (!data) {
    return (
      <AnalyticsPageLayout title="이직 분석">
        <EmptyChart />
      </AnalyticsPageLayout>
    )
  }

  return (
    <AnalyticsPageLayout title="이직 분석" description="월별 퇴사 트렌드, 사유 분석, 부서별 이직률">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 월별 퇴사 트렌드 + 이직률 */}
        <ChartCard title="월별 퇴사 트렌드" className="lg:col-span-2">
          {data.monthlyTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <ComposedChart data={data.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" unit="%" />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="resignations" fill="#EF4444" radius={[4, 4, 0, 0]} name="퇴사자" />
                <Line yAxisId="right" dataKey="turnover_rate" stroke="#6366F1" strokeWidth={2} dot={{ r: 3 }} name="이직률(%)" />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>

        {/* 퇴사 사유 분포 */}
        <ChartCard title="퇴사 사유 분포">
          {data.byReason.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data.byReason}
                  dataKey="count"
                  nameKey="reason"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                >
                  {data.byReason.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
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

        {/* 부서별 이직률 */}
        <ChartCard title="부서별 이직률">
          {data.byDepartment.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.byDepartment} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" unit="%" />
                <YAxis type="category" dataKey="department_name" width={70} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="turnover_rate" fill="#F59E0B" radius={[0, 4, 4, 0]} name="이직률(%)" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>

        {/* 자발적/비자발적 비율 */}
        <ChartCard title="퇴직 유형 분포" className="lg:col-span-2">
          {data.byResignType.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.byResignType} layout="vertical" margin={{ left: 100 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="resign_type" width={90} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#8B5CF6" radius={[0, 4, 4, 0]} name="건수" />
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
