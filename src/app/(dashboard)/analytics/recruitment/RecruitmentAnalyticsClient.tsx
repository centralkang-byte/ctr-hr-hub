'use client'

import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

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
import { TABLE_STYLES, CHART_THEME } from '@/lib/styles'
import { cn } from '@/lib/utils'
import type { SessionUser } from '@/types'

const STAGE_ORDER = ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED']

export default function RecruitmentAnalyticsClient({ user }: { user: SessionUser }) {
  const tCommon = useTranslations('common')
  const t = useTranslations('analytics.recruitmentPage')

  const searchParams = useSearchParams()
  const companyId = searchParams.get('company_id') ?? undefined

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
        <ChartCard title={t('funnel')} className="lg:col-span-2">
          {sortedFunnel.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={sortedFunnel} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
                <XAxis type="number" />
                <YAxis type="category" dataKey="stage_label" width={70} tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={CHART_THEME.tooltip.contentStyle} labelStyle={CHART_THEME.tooltip.labelStyle} />
                <Bar dataKey="candidate_count" fill={CHART_THEME.colors[3]} radius={[0, 4, 4, 0]} name={t('headcount')} />
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
              <table className={TABLE_STYLES.table}>
                <thead className={TABLE_STYLES.header}>
                  <tr>
                    <th className={TABLE_STYLES.headerCell}>{t('posting')}</th>
                    {STAGE_ORDER.map((s) => (
                      <th key={s} className={TABLE_STYLES.headerCellRight}>
                        {STAGE_LABELS[s] ?? s}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[...postingMap.entries()].map(([id, { title, stages }]) => (
                    <tr key={id} className={TABLE_STYLES.row}>
                      <td className={TABLE_STYLES.cell}>{title}</td>
                      {STAGE_ORDER.map((s) => (
                        <td key={s} className={TABLE_STYLES.cellRight}>
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
