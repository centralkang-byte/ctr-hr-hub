'use client'

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
  const searchParams = useSearchParams()
  const companyId = searchParams.get('company_id') ?? undefined
  const { toast } = useToast()
  const t = useTranslations('analytics.executiveReportPage')

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
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          {/* Report header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-slate-900">HR Analytics Report</h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                <Sparkles className="h-3 w-3" />
                AI Generated
              </span>
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <Clock className="h-3 w-3" />
                {new Date(report.generatedAt).toLocaleString('ko-KR')}
              </span>
            </div>
          </div>

          {/* Report content (markdown) */}
          <div className="prose prose-sm max-w-none px-6 py-6">
            {report.content.split('\n').map((line, i) => {
              if (line.startsWith('# ')) {
                return <h1 key={i} className="mb-4 mt-6 text-xl font-bold text-slate-900">{line.slice(2)}</h1>
              }
              if (line.startsWith('## ')) {
                return <h2 key={i} className="mb-3 mt-5 text-lg font-semibold text-slate-800">{line.slice(3)}</h2>
              }
              if (line.startsWith('### ')) {
                return <h3 key={i} className="mb-2 mt-4 text-base font-semibold text-slate-700">{line.slice(4)}</h3>
              }
              if (line.startsWith('- ')) {
                return <li key={i} className="ml-4 text-sm text-slate-600">{line.slice(2)}</li>
              }
              if (line.startsWith('**') && line.endsWith('**')) {
                return <p key={i} className="text-sm font-semibold text-slate-700">{line.slice(2, -2)}</p>
              }
              if (line.trim() === '') {
                return <br key={i} />
              }
              return <p key={i} className="text-sm text-slate-600">{line}</p>
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 py-20">
          <Sparkles className="mb-4 h-12 w-12 text-slate-300" />
          <p className="text-sm font-medium text-slate-500">
            {t('promptMessage')}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {t('promptDescription')}
          </p>
        </div>
      )}
    </AnalyticsPageLayout>
  )
}
