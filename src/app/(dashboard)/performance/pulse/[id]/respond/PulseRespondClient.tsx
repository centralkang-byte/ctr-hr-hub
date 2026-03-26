'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Send, CheckCircle2 } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { BUTTON_VARIANTS } from '@/lib/styles'
import type { SessionUser } from '@/types'

// ─── Types ───────────────────────────────────────────────

interface Question {
  id: string
  questionText: string
  questionType: 'LIKERT' | 'TEXT' | 'CHOICE'
  options: string[] | null
  sortOrder: number
  isRequired: boolean
}

interface SurveyDetail {
  id: string
  title: string
  description: string | null
  anonymityLevel: string
  closeAt: string
  questions: Question[]
}

const LIKERT_LABELS = ['매우 부정', '부정', '보통', '긍정', '매우 긍정']

// ─── Component ───────────────────────────────────────────

export default function PulseRespondClient({ user, id }: { user: SessionUser; id: string }) {
  const tCommon = useTranslations('common')
  const t = useTranslations('performance')
  const router = useRouter()

  const [survey, setSurvey] = useState<SurveyDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const fetchSurvey = useCallback(async () => {
    try {
      const res = await apiClient.get<SurveyDetail>(`/api/v1/pulse/surveys/${id}`)
      setSurvey(res.data)
    } catch (err) {
      toast({ title: '설문 로드 실패', description: err instanceof Error ? err.message : '다시 시도해 주세요.', variant: 'destructive' })
    }
    setLoading(false)
  }, [id])

  useEffect(() => { fetchSurvey() }, [fetchSurvey])

  const setAnswer = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  const handleSubmit = async () => {
    if (!survey) return
    setSubmitting(true)
    try {
      const answerList = Object.entries(answers).map(([questionId, answerValue]) => ({
        questionId,
        answerValue,
      }))
      await apiClient.post(`/api/v1/pulse/surveys/${id}/respond`, { answers: answerList })
      setSubmitted(true)
    } catch (err) {
      toast({ title: '응답 제출 실패', description: err instanceof Error ? err.message : '다시 시도해 주세요.', variant: 'destructive' })
    }
    setSubmitting(false)
  }

  if (loading) return <div className="p-6 text-center text-[#999]">{tCommon('loading')}</div>
  if (!survey) return <div className="p-6 text-center text-[#999]">{t('kr_kec84a4eb_kecb0beec_kec8898_ke')}</div>

  if (submitted) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <CheckCircle2 className="w-16 h-16 text-[#5E81F4]" />
        <h2 className="text-xl font-bold text-[#1A1A1A]">{t('kr_kec9d91eb_keca09cec')}</h2>
        <p className="text-sm text-[#666]">{t('kr_kec868cec_kec9d98ea_keab090ec')}</p>
        <button onClick={() => router.push('/performance/pulse')}
          className={`px-4 py-2 ${BUTTON_VARIANTS.primary} rounded-lg text-sm font-medium`}>
          {t('kr_keb8f8cec')}
        </button>
      </div>
    )
  }

  const requiredIds = survey.questions.filter((q) => q.isRequired).map((q) => q.id)
  const allRequiredAnswered = requiredIds.every((qId) => answers[qId]?.trim())

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/performance/pulse')} className="p-1 hover:bg-[#F5F5F5] rounded-lg">
          <ArrowLeft className="w-5 h-5 text-[#666]" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">{survey.title}</h1>
          {survey.description && <p className="text-sm text-[#666] mt-1">{survey.description}</p>}
        </div>
      </div>

      <div className="bg-[#E0E7FF] rounded-xl border border-[#C7D2FE] p-4 text-sm text-[#4B6DE0]">
        {survey.anonymityLevel === 'FULL_ANONYMOUS'
          ? '이 설문은 완전 익명으로 진행됩니다. 응답자 정보가 기록되지 않습니다.'
          : '이 설문은 부서 단위로 익명이 보장됩니다.'}
        <br />마감: {new Date(survey.closeAt).toLocaleDateString('ko-KR')}
      </div>

      {/* Questions */}
      <div className="space-y-6">
        {survey.questions.map((q, i) => (
          <div key={q.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-start gap-2 mb-3">
              <span className="text-xs font-medium text-[#999]">Q{i + 1}</span>
              <div>
                <p className="text-sm font-medium text-[#1A1A1A]">
                  {q.questionText}
                  {q.isRequired && <span className="text-[#EF4444] ml-1">*</span>}
                </p>
              </div>
            </div>

            {q.questionType === 'LIKERT' && (
              <div className="flex gap-2 mt-3">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button key={v} onClick={() => setAnswer(q.id, String(v))}
                    className={`flex-1 py-3 rounded-lg border text-sm font-medium transition-colors ${
                      answers[q.id] === String(v)
                        ? 'bg-[#5E81F4] text-white border-[#5E81F4]'
                        : 'bg-white text-[#555] border-[#D4D4D4] hover:bg-[#FAFAFA]'
                    }`}>
                    <div className="text-lg">{v}</div>
                    <div className="text-xs mt-1 opacity-80">{LIKERT_LABELS[v - 1]}</div>
                  </button>
                ))}
              </div>
            )}

            {q.questionType === 'TEXT' && (
              <textarea
                value={answers[q.id] ?? ''}
                onChange={(e) => setAnswer(q.id, e.target.value)}
                placeholder={tCommon('enterContent')}
                rows={3}
                className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#5E81F4]/10 placeholder:text-[#999]"
              />
            )}

            {q.questionType === 'CHOICE' && q.options && (
              <div className="space-y-2 mt-3">
                {(q.options as string[]).map((opt) => (
                  <button key={opt} onClick={() => setAnswer(q.id, opt)}
                    className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-colors ${
                      answers[q.id] === opt
                        ? 'bg-[#EDF1FE] text-[#4B6DE0] border-[#5E81F4]'
                        : 'bg-white text-[#555] border-[#D4D4D4] hover:bg-[#FAFAFA]'
                    }`}>
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Submit */}
      <div className="flex justify-end">
        <button onClick={handleSubmit} disabled={submitting || !allRequiredAnswered}
          className={`flex items-center gap-2 px-6 py-2.5 ${BUTTON_VARIANTS.primary} rounded-lg text-sm font-medium disabled:opacity-50`}>
          <Send className="w-4 h-4" />
          {submitting ? '제출 중...' : '응답 제출'}
        </button>
      </div>
    </div>
  )
}
