'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, BarChart3, Sparkles } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { apiClient } from '@/lib/api'

// ─── Types ───────────────────────────────────────────────

interface QuestionResult {
  questionId: string
  questionText: string
  questionType: string
  responseCount: number
  average?: number
  distribution?: Record<string, number>
  answers?: string[]
}

interface SurveyResults {
  surveyId: string
  title: string
  totalRespondents: number
  questionResults: QuestionResult[]
  departmentBreakdown: Record<string, Record<string, number>>
}

interface AiAnalysis {
  overall_sentiment: string
  key_insights: string[]
  risk_areas: string[]
  recommendations: string[]
  department_comparison?: string
}

const CHART_COLORS = ['#00C853', '#059669', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4']

// ─── Component ───────────────────────────────────────────

export default function PulseResultsClient() {
  const tCommon = useTranslations('common')
  const t = useTranslations('performance')

  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [results, setResults] = useState<SurveyResults | null>(null)
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [aiLoading, setAiLoading] = useState(false)

  const fetchResults = useCallback(async () => {
    try {
      const res = await apiClient.get<SurveyResults>(`/api/v1/pulse/surveys/${id}/results`)
      setResults(res.data)
    } catch { /* ignore */ }
    setLoading(false)
  }, [id])

  useEffect(() => { fetchResults() }, [fetchResults])

  const handleAiAnalysis = async () => {
    setAiLoading(true)
    try {
      const res = await apiClient.post<AiAnalysis>('/api/v1/ai/pulse-analysis', { surveyId: id })
      setAiAnalysis(res.data)
    } catch { /* ignore */ }
    setAiLoading(false)
  }

  if (loading) return <div className="p-6 text-center text-[#999]">로딩 중...</div>
  if (!results) return <div className="p-6 text-center text-[#999]">결과를 불러올 수 없습니다.</div>

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/performance/pulse')} className="p-1 hover:bg-[#F5F5F5] rounded-lg">
            <ArrowLeft className="w-5 h-5 text-[#666]" />
          </button>
          <BarChart3 className="w-6 h-6 text-[#00C853]" />
          <div>
            <h1 className="text-2xl font-bold text-[#1A1A1A]">{results.title} — 결과</h1>
            <p className="text-sm text-[#666]">총 {results.totalRespondents}명 응답</p>
          </div>
        </div>
        <button onClick={handleAiAnalysis} disabled={aiLoading}
          className="flex items-center gap-2 px-4 py-2 border border-[#C7D2FE] text-[#4338CA] rounded-lg text-sm font-medium hover:bg-[#E0E7FF] disabled:opacity-50">
          <Sparkles className="w-4 h-4" />
          {aiLoading ? 'AI 분석 중...' : 'AI 인사이트'}
        </button>
      </div>

      {/* AI Analysis */}
      {aiAnalysis && (
        <div className="bg-[#E0E7FF] rounded-xl border border-[#C7D2FE] p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#4338CA]" />
            <span className="text-sm font-semibold text-[#4338CA]">AI 분석 결과</span>
          </div>
          <p className="text-sm text-[#333]">{aiAnalysis.overall_sentiment}</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <h4 className="text-xs font-medium text-[#4338CA] mb-2">핵심 인사이트</h4>
              <ul className="space-y-1">{aiAnalysis.key_insights.map((ins, i) => (
                <li key={i} className="text-xs text-[#333]">• {ins}</li>
              ))}</ul>
            </div>
            <div>
              <h4 className="text-xs font-medium text-[#B91C1C] mb-2">주의 영역</h4>
              <ul className="space-y-1">{aiAnalysis.risk_areas.map((r, i) => (
                <li key={i} className="text-xs text-[#333]">• {r}</li>
              ))}</ul>
            </div>
            <div>
              <h4 className="text-xs font-medium text-[#059669] mb-2">개선 제안</h4>
              <ul className="space-y-1">{aiAnalysis.recommendations.map((r, i) => (
                <li key={i} className="text-xs text-[#333]">• {r}</li>
              ))}</ul>
            </div>
          </div>
          {aiAnalysis.department_comparison && (
            <p className="text-xs text-[#555] border-t border-[#C7D2FE] pt-2 mt-2">{aiAnalysis.department_comparison}</p>
          )}
        </div>
      )}

      {/* Question Results */}
      <div className="space-y-6">
        {results.questionResults.map((q, i) => (
          <div key={q.questionId} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className="text-xs text-[#999] font-medium">Q{i + 1}</span>
                <h3 className="text-sm font-semibold text-[#1A1A1A] mt-1">{q.questionText}</h3>
              </div>
              <span className="text-xs text-[#666]">{q.responseCount}명 응답</span>
            </div>

            {q.questionType === 'LIKERT' && q.distribution && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-[#1A1A1A]">{q.average}</span>
                  <span className="text-sm text-[#666]">/ 5.0</span>
                </div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[1, 2, 3, 4, 5].map((v) => ({
                      label: String(v),
                      count: q.distribution![String(v)] ?? 0,
                    }))}>
                      <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
                      <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#666' }} />
                      <YAxis tick={{ fontSize: 12, fill: '#666' }} />
                      <Tooltip contentStyle={CHART_THEME.tooltip.contentStyle} labelStyle={CHART_THEME.tooltip.labelStyle} />
                      <Bar dataKey="count" fill={CHART_THEME.colors[3]} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {q.questionType === 'CHOICE' && q.distribution && (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={Object.entries(q.distribution).map(([name, value]) => ({ name, value }))}
                      cx="50%" cy="50%" outerRadius={70}
                      dataKey="value" label
                    >
                      {Object.keys(q.distribution).map((_, idx) => (
                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={CHART_THEME.tooltip.contentStyle} labelStyle={CHART_THEME.tooltip.labelStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {q.questionType === 'TEXT' && q.answers && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {q.answers.map((a, idx) => (
                  <div key={idx} className="bg-[#FAFAFA] rounded-lg px-3 py-2 text-sm text-[#333]">{a}</div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
