'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Attendance Analytics Client
// 근태 분석 (주별트렌드/초과근무/지각)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, AlertTriangle } from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { apiClient } from '@/lib/api'
import { AnalyticsPageLayout } from '@/components/analytics/AnalyticsPageLayout'
import { ChartCard } from '@/components/analytics/ChartCard'
import { EmptyChart } from '@/components/analytics/EmptyChart'
import { AnalyticsKpiCard } from '@/components/analytics/AnalyticsKpiCard'
import type { AttendanceData } from '@/lib/analytics/types'

export default function AttendanceAnalyticsClient() {
  const searchParams = useSearchParams()
  const companyId = searchParams.get('company_id') ?? undefined

  const [data, setData] = useState<AttendanceData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<AttendanceData>('/api/v1/analytics/attendance', {
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
      <AnalyticsPageLayout title="근태 분석">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </AnalyticsPageLayout>
    )
  }

  if (!data) {
    return (
      <AnalyticsPageLayout title="근태 분석">
        <EmptyChart />
      </AnalyticsPageLayout>
    )
  }

  return (
    <AnalyticsPageLayout title="근태 분석" description="주별 근무시간 트렌드, 초과근무, 지각/결근 현황">
      {/* 52시간 초과 위험 KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <AnalyticsKpiCard
          label="52시간 초과 위험자"
          value={data.over52hCount}
          icon={AlertTriangle}
          suffix="명"
          color={data.over52hCount > 0 ? 'danger' : 'success'}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 주별 근무시간 트렌드 */}
        <ChartCard title="주별 근무시간 트렌드" className="lg:col-span-2">
          {data.weeklyTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={data.weeklyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week_start" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="avg_total_hours" stroke="#2563EB" fill="#2563EB" fillOpacity={0.1} strokeWidth={2} name="평균 근무시간" />
                <Area type="monotone" dataKey="avg_overtime_hours" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.1} strokeWidth={2} name="평균 초과근무" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>

        {/* 초과근무 상위 부서 */}
        <ChartCard title="초과근무 상위 부서">
          {data.overtimeByDept.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.overtimeByDept} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" unit="h" />
                <YAxis type="category" dataKey="department_name" width={70} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="avg_overtime_hours" fill="#F97316" radius={[0, 4, 4, 0]} name="평균 초과근무(시간)" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>

        {/* 지각/결근/조퇴 트렌드 */}
        <ChartCard title="지각/결근/조퇴 트렌드">
          {data.issuesTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.issuesTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week_start" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="late_count" stackId="a" fill="#F59E0B" name="지각" />
                <Bar dataKey="absent_count" stackId="a" fill="#EF4444" name="결근" />
                <Bar dataKey="early_out_count" stackId="a" fill="#F97316" name="조퇴" radius={[4, 4, 0, 0]} />
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
