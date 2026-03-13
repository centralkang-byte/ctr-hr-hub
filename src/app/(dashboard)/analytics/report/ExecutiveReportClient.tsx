'use client'

import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Executive Report Client
// AI 경영진 보고서 생성 + 마크다운 렌더링
// ═══════════════════════════════════════════════════════════

import { useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Sparkles, Loader2, FileText, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { apiClient } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { AnalyticsPageLayout } from '@/components/analytics/AnalyticsPageLayout'
import type { ExecutiveReport } from '@/lib/analytics/types'

export default function ExecutiveReportClient() {
  const tCommon = useTranslations('common')
  const t = useTranslations('analytics.executiveReportPage')

  const searchParams = useSearchParams()
  const companyId = searchParams.get('company_id') ?? undefined
  const { toast } = useToast()

  const [report, setReport] = useState<ExecutiveReport | null>(null)
  const [loading, setLoading] = useState(false)

  const generateReport = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.post<ExecutiveReport>('/api/v1/ai/executive-report', {
        company_id: companyId,
      })
      setReport(res.data)
      toast({ title: t('reportGenerated') })
    } catch {
      toast({ title: t('reportFailed'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [companyId, toast, t])

  return (
    <AnalyticsPageLayout
      title={t('title')}
      description={t('description')}
      actions={
        <Button onClick={generateReport} disabled={loading}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          {t('generateButton')}
        </Button>
      }
    >
      {report ? (
        <div className="rounded-xl border border-[#E8E8E8] bg-white">
          {/* Report header */}
          <div className="flex items-center justify-between border-b border-[#F5F5F5] px-6 py-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-[#4F46E5]" />
              <h2 className="text-lg font-semibold text-[#1A1A1A]">HR Analytics Report</h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#C7D2FE] bg-[#E0E7FF] px-2.5 py-0.5 text-xs font-medium text-[#4338CA]">
                <Sparkles className="h-3 w-3" />
                AI Generated
              </span>
              <span className="flex items-center gap-1 text-xs text-[#666]">
                <Clock className="h-3 w-3" />
                {new Date(report.generatedAt).toLocaleString('ko-KR')}
              </span>
            </div>
          </div>

          {/* Report content (markdown) */}
          <div className="prose prose-sm max-w-none px-6 py-6">
            {report.content.split('\n').map((line, i) => {
              if (line.startsWith('# ')) {
                return <h1 key={i} className="mb-4 mt-6 text-xl font-bold text-[#1A1A1A]">{line.slice(2)}</h1>
              }
              if (line.startsWith('## ')) {
                return <h2 key={i} className="mb-3 mt-5 text-lg font-semibold text-[#1A1A1A]">{line.slice(3)}</h2>
              }
              if (line.startsWith('### ')) {
                return <h3 key={i} className="mb-2 mt-4 text-base font-semibold text-[#333]">{line.slice(4)}</h3>
              }
              if (line.startsWith('- ')) {
                return <li key={i} className="ml-4 text-sm text-[#555]">{line.slice(2)}</li>
              }
              if (line.startsWith('**') && line.endsWith('**')) {
                return <p key={i} className="text-sm font-semibold text-[#333]">{line.slice(2, -2)}</p>
              }
              if (line.trim() === '') {
                return <br key={i} />
              }
              return <p key={i} className="text-sm text-[#555]">{line}</p>
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#D4D4D4] bg-[#FAFAFA] py-20">
          <Sparkles className="mb-4 h-12 w-12 text-[#D4D4D4]" />
          <p className="text-sm font-medium text-[#666]">
            {t('promptMessage')}
          </p>
          <p className="mt-1 text-xs text-[#999]">
            {t('promptDescription')}
          </p>
        </div>
      )}
    </AnalyticsPageLayout>
  )
}
