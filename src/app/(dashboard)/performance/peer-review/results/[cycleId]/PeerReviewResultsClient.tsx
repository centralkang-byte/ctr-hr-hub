'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { ArrowLeft, Users, Sparkles } from 'lucide-react'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts'
import { apiClient } from '@/lib/api'
import { CHART_THEME } from '@/lib/styles'

// ─── Types ───────────────────────────────────────────────

interface EvalDetail {
  id: string
  competencyScore: number
  competencyDetail: Record<string, number> | null
  comment: string | null
  submittedAt: string
  evaluator: { id: string; name: string; department: { name: string } | null }
}

interface ResultData {
  employeeId: string
  cycleId: string
  evaluations: EvalDetail[]
  summary: {
    reviewerCount: number
    averageScore: number
    competencyAvg: Record<string, number>
  } | null
}

interface AiSummary {
  summary: string
  strengths: string[]
  development_areas: string[]
  coaching_suggestion: string
}

const COMPETENCY_LABELS: Record<string, string> = {
  collaboration: '협업',
  communication: '소통',
  reliability: '신뢰성',
  expertise: '전문성',
  initiative: '주도성',
  respect: '존중',
  growth: '성장',
  impact: '영향력',
}

// ─── Component ───────────────────────────────────────────

export default function PeerReviewResultsClient() {
  const tCommon = useTranslations('common')
  const t = useTranslations('performance')

  const { cycleId } = useParams<{ cycleId: string }>()
  const searchParams = useSearchParams()
  const employeeId = searchParams.get('employeeId') ?? ''
  const router = useRouter()

  const [results, setResults] = useState<ResultData | null>(null)
  const [aiSummary, setAiSummary] = useState<AiSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [aiLoading, setAiLoading] = useState(false)

  const fetchResults = useCallback(async () => {
    if (!employeeId) return
    try {
      const res = await apiClient.get<ResultData>(
        `/api/v1/peer-review/results?cycleId=${cycleId}&employeeId=${employeeId}`
      )
      setResults(res.data)
    } catch { /* ignore */ }
    setLoading(false)
  }, [cycleId, employeeId])

  useEffect(() => { fetchResults() }, [fetchResults])

  const handleAiSummary = async () => {
    setAiLoading(true)
    try {
      const res = await apiClient.post<AiSummary>('/api/v1/ai/peer-review-summary', { cycleId, employeeId })
      setAiSummary(res.data)
    } catch { /* ignore */ }
    setAiLoading(false)
  }

  if (loading) return <div className="p-6 text-center text-[#999]">{tCommon('loading')}</div>
  if (!results || !results.summary) return <EmptyState title="데이터가 없습니다" description="조건을 변경하거나 새로운 데이터를 추가해보세요." />

  const radarData = Object.entries(results.summary.competencyAvg).map(([key, value]) => ({
    competency: COMPETENCY_LABELS[key] ?? key,
    score: value,
    fullMark: 5,
  }))

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1 hover:bg-[#F5F5F5] rounded-lg">
            <ArrowLeft className="w-5 h-5 text-[#666]" />
          </button>
          <Users className="w-6 h-6 text-[#5E81F4]" />
          <div>
            <h1 className="text-2xl font-bold text-[#1A1A1A]">{t('peerReview_keab2b0ea')}</h1>
            <p className="text-sm text-[#666]">{results.summary.reviewerCount}명의 동료 평가 종합</p>
          </div>
        </div>
        <button onClick={handleAiSummary} disabled={aiLoading}
          className="flex items-center gap-2 px-4 py-2 border border-[#C7D2FE] text-[#4B6DE0] rounded-lg text-sm font-medium hover:bg-[#E0E7FF] disabled:opacity-50">
          <Sparkles className="w-4 h-4" />
          {aiLoading ? t('aiAnalyzing') : 'AI 요약'}
        </button>
      </div>

      {/* KPI + Radar */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <p className="text-xs text-[#666] mb-1">{t('kr_keca285ed_score')}</p>
          <p className="text-4xl font-bold text-[#5E81F4]">{results.summary.averageScore} <span className="text-lg text-[#666]">/ 5.0</span></p>
          <div className="mt-4 space-y-2">
            {Object.entries(results.summary.competencyAvg).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-[#555]">{COMPETENCY_LABELS[key] ?? key}</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-[#E8E8E8] rounded-full overflow-hidden">
                    <div className="h-full bg-[#5E81F4] rounded-full" style={{ width: `${(val / 5) * 100}%` }} />
                  </div>
                  <span className="text-sm font-medium text-[#1A1A1A] w-8 text-right">{val}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {radarData.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-base font-semibold text-[#1A1A1A] mb-2">{t('kr_kec97adeb_keba088ec')}</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#E8E8E8" />
                  <PolarAngleAxis dataKey="competency" tick={{ fontSize: 11, fill: '#555' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 5]} tick={{ fontSize: 10, fill: '#999' }} />
                  <Radar name="점수" dataKey="score" stroke={CHART_THEME.colors[3]} fill={CHART_THEME.colors[3]} fillOpacity={0.3} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* AI Summary */}
      {aiSummary && (
        <div className="bg-[#E0E7FF] rounded-xl border border-[#C7D2FE] p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#4B6DE0]" />
            <span className="text-sm font-semibold text-[#4B6DE0]">{t('kr_ai_keca285ed_analytics')}</span>
          </div>
          <p className="text-sm text-[#333]">{aiSummary.summary}</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-xs font-medium text-[#059669] mb-2">{t('kr_keab095ec')}</h4>
              <ul className="space-y-1">{aiSummary.strengths.map((s, i) => (
                <li key={i} className="text-xs text-[#333]">• {s}</li>
              ))}</ul>
            </div>
            <div>
              <h4 className="text-xs font-medium text-[#B45309] mb-2">{t('kr_keab09ceb_kec9881ec')}</h4>
              <ul className="space-y-1">{aiSummary.development_areas.map((d, i) => (
                <li key={i} className="text-xs text-[#333]">• {d}</li>
              ))}</ul>
            </div>
          </div>
          <div className="border-t border-[#C7D2FE] pt-2">
            <h4 className="text-xs font-medium text-[#4B6DE0] mb-1">{t('kr_kecbd94ec_keca09cec')}</h4>
            <p className="text-xs text-[#333]">{aiSummary.coaching_suggestion}</p>
          </div>
        </div>
      )}

      {/* Individual Comments */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-base font-semibold text-[#1A1A1A] mb-3">{t('kr_keab09ceb_kecbd94eb')}</h3>
        <div className="space-y-3">
          {results.evaluations.filter((e) => e.comment).map((e, i) => (
            <div key={e.id} className="bg-[#FAFAFA] rounded-lg px-4 py-3">
              <p className="text-sm text-[#333]">{e.comment}</p>
              <p className="text-xs text-[#999] mt-2">
                리뷰어 {i + 1} · {new Date(e.submittedAt).toLocaleDateString('ko-KR')}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
