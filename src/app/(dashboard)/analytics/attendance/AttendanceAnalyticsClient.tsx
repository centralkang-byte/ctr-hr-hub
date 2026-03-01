'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Attendance Analytics Client
// 근태 분석 (주별트렌드/초과근무/지각)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
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
  const t = useTranslations('analytics.attendancePage')
  const ta = useTranslations('analytics')

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
      <AnalyticsPageLayout title={t('title')}>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </AnalyticsPageLayout>
    )
  }

  if (!data) {
    return (
      <AnalyticsPageLayout title={t('title')}>
        <EmptyChart />
      </AnalyticsPageLayout>
    )
  }

  return (
    <AnalyticsPageLayout title={t('title')} description={t('description')}>
      {/* 52시간 초과 위험 KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <AnalyticsKpiCard
          label={t('over52hRisk')}
          value={data.over52hCount}
          icon={AlertTriangle}
          suffix={ta('personSuffix')}
          color={data.over52hCount > 0 ? 'danger' : 'success'}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 주별 근무시간 트렌드 */}
        <ChartCard title={t('weeklyHoursTrend')} className="lg:col-span-2">
          {data.weeklyTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={data.weeklyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week_start" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="avg_total_hours" stroke="#2563EB" fill="#2563EB" fillOpacity={0.1} strokeWidth={2} name={t('avgWorkHours')} />
                <Area type="monotone" dataKey="avg_overtime_hours" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.1} strokeWidth={2} name={t('avgOvertime')} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>

        {/* 초과근무 상위 부서 */}
        <ChartCard title={t('topOvertimeDepts')}>
          {data.overtimeByDept.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.overtimeByDept} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" unit="h" />
                <YAxis type="category" dataKey="department_name" width={70} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="avg_overtime_hours" fill="#F97316" radius={[0, 4, 4, 0]} name={t('avgOvertimeHours')} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>

        {/* 지각/결근/조퇴 트렌드 */}
        <ChartCard title={t('issuesTrend')}>
          {data.issuesTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.issuesTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week_start" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="late_count" stackId="a" fill="#F59E0B" name={t('late')} />
                <Bar dataKey="absent_count" stackId="a" fill="#EF4444" name={t('absent')} />
                <Bar dataKey="early_out_count" stackId="a" fill="#F97316" name={t('earlyOut')} radius={[4, 4, 0, 0]} />
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
