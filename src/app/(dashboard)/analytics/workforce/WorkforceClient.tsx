'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Workforce Analytics Client
// 인력구성 분석 (부서별/고용형태/직급분포)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { apiClient } from '@/lib/api'
import { AnalyticsPageLayout } from '@/components/analytics/AnalyticsPageLayout'
import { ChartCard } from '@/components/analytics/ChartCard'
import { EmptyChart } from '@/components/analytics/EmptyChart'
import type { WorkforceData } from '@/lib/analytics/types'

const COLORS = ['#2563EB', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4']

export default function WorkforceClient() {
  const searchParams = useSearchParams()
  const companyId = searchParams.get('company_id') ?? undefined
  const t = useTranslations('analytics.workforcePage')

  const [data, setData] = useState<WorkforceData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<WorkforceData>('/api/v1/analytics/workforce', {
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
      <AnalyticsPageLayout title={t('title')} description={t('description')}>
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
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 부서별 인원 */}
        <ChartCard title={t('byDepartment')} className="lg:col-span-2">
          {data.byDepartment.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(300, data.byDepartment.length * 40)}>
              <BarChart data={data.byDepartment} layout="vertical" margin={{ left: 100 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="department_name" width={90} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="headcount" fill="#2563EB" radius={[0, 4, 4, 0]} name={t('headcount')} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>

        {/* 고용형태 분포 */}
        <ChartCard title={t('byEmploymentType')}>
          {data.byEmploymentType.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data.byEmploymentType}
                  dataKey="headcount"
                  nameKey="employment_type"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {data.byEmploymentType.map((_, i) => (
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

        {/* 직급별 분포 */}
        <ChartCard title={t('byGrade')}>
          {data.byGrade.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.byGrade}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="grade_name" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="headcount" fill="#10B981" radius={[4, 4, 0, 0]} name={t('headcount')} />
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
