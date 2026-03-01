'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Recruitment Analytics Client
// 채용 분석 (퍼널/전환율)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { apiClient } from '@/lib/api'
import { AnalyticsPageLayout } from '@/components/analytics/AnalyticsPageLayout'
import { ChartCard } from '@/components/analytics/ChartCard'
import { EmptyChart } from '@/components/analytics/EmptyChart'
import type { RecruitmentData } from '@/lib/analytics/types'

const STAGE_ORDER = ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED']

export default function RecruitmentAnalyticsClient() {
  const searchParams = useSearchParams()
  const companyId = searchParams.get('company_id') ?? undefined
  const t = useTranslations('analytics.recruitmentPage')

  const STAGE_LABELS: Record<string, string> = {
    APPLIED: t('stages.APPLIED'),
    SCREENING: t('stages.SCREENING'),
    INTERVIEW: t('stages.INTERVIEW'),
    OFFER: t('stages.OFFER'),
    HIRED: t('stages.HIRED'),
  }

  const [data, setData] = useState<RecruitmentData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<RecruitmentData>('/api/v1/analytics/recruitment', {
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

  // Sort funnel by stage order
  const sortedFunnel = [...data.funnel].sort((a, b) => {
    const ai = STAGE_ORDER.indexOf(a.stage)
    const bi = STAGE_ORDER.indexOf(b.stage)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  }).map((r) => ({
    ...r,
    stage_label: STAGE_LABELS[r.stage] ?? r.stage,
  }))

  // Group postings for table
  const postingMap = new Map<string, { title: string; stages: Record<string, number> }>()
  for (const row of data.conversionByPosting) {
    if (!postingMap.has(row.posting_id)) {
      postingMap.set(row.posting_id, { title: row.posting_title, stages: {} })
    }
    postingMap.get(row.posting_id)!.stages[row.stage] = row.candidate_count
  }

  return (
    <AnalyticsPageLayout title={t('title')} description={t('description')}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 채용 퍼널 */}
        <ChartCard title={t('funnel')} description={t('funnelDescription')} className="lg:col-span-2">
          {sortedFunnel.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={sortedFunnel} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="stage_label" width={70} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="candidate_count" fill="#2563EB" radius={[0, 4, 4, 0]} name={t('headcount')} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message={t('noRecruitmentData')} />
          )}
        </ChartCard>

        {/* 공고별 전환율 테이블 */}
        <ChartCard title={t('conversionByPosting')} className="lg:col-span-2">
          {postingMap.size > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">{t('posting')}</th>
                    {STAGE_ORDER.map((s) => (
                      <th key={s} className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">
                        {STAGE_LABELS[s] ?? s}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...postingMap.entries()].map(([id, { title, stages }]) => (
                    <tr key={id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-700">{title}</td>
                      {STAGE_ORDER.map((s) => (
                        <td key={s} className="px-4 py-3 text-center text-slate-600">
                          {stages[s] ?? 0}
                        </td>
                      ))}
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
