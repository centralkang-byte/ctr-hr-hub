'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Compensation Analytics Client
// 보상 분석 (compa-ratio분포/직급별)
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
import { AnalyticsKpiCard } from '@/components/analytics/AnalyticsKpiCard'
import type { CompensationData } from '@/lib/analytics/types'
import { Banknote } from 'lucide-react'
import { TABLE_STYLES } from '@/lib/styles'

const BAND_COLORS = ['#EF4444', '#10B981', '#F59E0B']

export default function CompensationAnalyticsClient() {
  const searchParams = useSearchParams()
  const companyId = searchParams.get('company_id') ?? undefined
  const t = useTranslations('analytics.compensationPage')

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
      <AnalyticsPageLayout title={t('title')}>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#999]" />
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

  const total = data.bandFit.under + data.bandFit.in_band + data.bandFit.over
  const bandPieData = [
    { name: 'Under Band', value: data.bandFit.under },
    { name: 'In Band', value: data.bandFit.in_band },
    { name: 'Over Band', value: data.bandFit.over },
  ]

  return (
    <AnalyticsPageLayout title={t('title')} description={t('description')}>
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
        <ChartCard title={t('avgCompaRatioByGrade')}>
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
        <ChartCard title={t('bandFit')}>
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
        <ChartCard title={t('compaRatioDetail')} className="lg:col-span-2">
          {data.distribution.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={TABLE_STYLES.header}>
                    <th className={TABLE_STYLES.headerCell}>{t('grade')}</th>
                    <th className={TABLE_STYLES.headerCell}>{t('jobCategory')}</th>
                    <th className={TABLE_STYLES.headerCell}>{t('headcount')}</th>
                    <th className={TABLE_STYLES.headerCell}>{t('average')}</th>
                    <th className={TABLE_STYLES.headerCell}>P25</th>
                    <th className={TABLE_STYLES.headerCell}>{t('median')}</th>
                    <th className={TABLE_STYLES.headerCell}>P75</th>
                  </tr>
                </thead>
                <tbody>
                  {data.distribution.map((r, i) => (
                    <tr key={i} className={TABLE_STYLES.header}>
                      <td className="px-4 py-3 font-medium text-[#333]">{r.grade_name}</td>
                      <td className="px-4 py-3 text-[#555]">{r.job_category_code}</td>
                      <td className="px-4 py-3 text-center text-[#555]">{r.employee_count}</td>
                      <td className="px-4 py-3 text-center text-[#555]">{r.avg_compa_ratio?.toFixed(3) ?? '-'}</td>
                      <td className="px-4 py-3 text-center text-[#555]">{r.p25?.toFixed(3) ?? '-'}</td>
                      <td className="px-4 py-3 text-center text-[#555]">{r.median?.toFixed(3) ?? '-'}</td>
                      <td className="px-4 py-3 text-center text-[#555]">{r.p75?.toFixed(3) ?? '-'}</td>
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
