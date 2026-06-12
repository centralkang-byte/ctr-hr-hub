'use client'

import { useTranslations, useLocale } from 'next-intl'
import { toast } from '@/hooks/use-toast'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Send, CheckCircle2 } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { BUTTON_VARIANTS } from '@/lib/styles'
import { useArrowKeyNavigation } from '@/hooks/useArrowKeyNavigation'
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

const LIKERT_LABEL_KEYS = ['pulse.likertVeryNegative', 'pulse.likertNegative', 'pulse.likertNeutral', 'pulse.likertPositive', 'pulse.likertVeryPositive']
const LIKERT_VALUES = [1, 2, 3, 4, 5]

// ─── Question Card ───────────────────────────────────────

interface QuestionCardProps {
  question: Question
  index: number
  value: string | undefined
  onAnswer: (questionId: string, value: string) => void
}

function QuestionCard({ question: q, index: i, value, onAnswer }: QuestionCardProps) {
  const tCommon = useTranslations('common')
  const t = useTranslations('performance')

  // LIKERT 1-5 radiogroup 방향키 내비게이션 + roving tabindex (5단계 보존). 선택은 기존 onClick 유지.
  // 미응답(findIndex=-1)이면 WAI-ARIA radiogroup 규칙대로 첫 항목을 tab anchor로 — aria-checked는 실선택만 반영.
  const likertNav = useArrowKeyNavigation(
    LIKERT_VALUES.length,
    Math.max(0, LIKERT_VALUES.findIndex((v) => String(v) === value)),
    (idx) => onAnswer(q.id, String(LIKERT_VALUES[idx])),
  )

  return (
    <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
      <div className="flex items-start gap-2 mb-3">
        <span className="text-xs font-medium text-muted-foreground">Q{i + 1}</span>
        <div>
          <p className="text-sm font-medium text-foreground">
            {q.questionText}
            {q.isRequired && <span className="text-destructive ml-1">*</span>}
          </p>
        </div>
      </div>

      {q.questionType === 'LIKERT' && (
        <div role="radiogroup" aria-label={q.questionText} className="flex gap-2 mt-3" onKeyDown={likertNav.onKeyDown}>
          {LIKERT_VALUES.map((v, idx) => (
            <button key={v} type="button" role="radio" aria-checked={value === String(v)}
              {...likertNav.itemProps(idx)}
              onClick={() => onAnswer(q.id, String(v))}
              className={`flex-1 py-3 rounded-lg border text-sm font-medium transition-colors ${
                value === String(v)
                  ? 'bg-primary text-white border-primary'
                  : 'bg-card text-muted-foreground border-border hover:bg-background'
              }`}>
              <div className="text-lg">{v}</div>
              <div className="text-xs mt-1 opacity-80">{t(LIKERT_LABEL_KEYS[v - 1])}</div>
            </button>
          ))}
        </div>
      )}

      {q.questionType === 'TEXT' && (
        <textarea
          value={value ?? ''}
          onChange={(e) => onAnswer(q.id, e.target.value)}
          placeholder={tCommon('enterContent')}
          rows={3}
          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10 placeholder:text-muted-foreground"
        />
      )}

      {q.questionType === 'CHOICE' && q.options && (
        <div className="space-y-2 mt-3">
          {(q.options as string[]).map((opt) => (
            <button key={opt} type="button" onClick={() => onAnswer(q.id, opt)}
              className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-colors ${
                value === opt
                  ? 'bg-primary/10 text-primary border-primary'
                  : 'bg-card text-muted-foreground border-border hover:bg-background'
              }`}>
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Component ───────────────────────────────────────────

export default function PulseRespondClient({ user: _user, id }: { user: SessionUser; id: string }) {
  const tCommon = useTranslations('common')
  const t = useTranslations('performance')
  const locale = useLocale()
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
      toast({ title: t('messages.surveyLoadFailed'), description: err instanceof Error ? err.message : t('messages.retryPlease'), variant: 'destructive' })
    }
    setLoading(false)
  }, [id, t])

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
      toast({ title: t('messages.responseSubmitFailed'), description: err instanceof Error ? err.message : t('messages.retryPlease'), variant: 'destructive' })
    }
    setSubmitting(false)
  }

  if (loading) return <div className="p-6 text-center text-muted-foreground">{tCommon('loading')}</div>
  if (!survey) return <div className="p-6 text-center text-muted-foreground">{t('kr_kec84a4eb_kecb0beec_kec8898_ke')}</div>

  if (submitted) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <CheckCircle2 className="w-16 h-16 text-primary" />
        <h2 className="text-xl font-bold text-foreground">{t('kr_kec9d91eb_keca09cec')}</h2>
        <p className="text-sm text-muted-foreground">{t('kr_kec868cec_kec9d98ea_keab090ec')}</p>
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
        <button onClick={() => router.push('/performance/pulse')} className="p-1 hover:bg-muted rounded-lg">
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{survey.title}</h1>
          {survey.description && <p className="text-sm text-muted-foreground mt-1">{survey.description}</p>}
        </div>
      </div>

      <div className="bg-primary/10 rounded-2xl border border-primary/20 p-4 text-sm text-primary">
        {survey.anonymityLevel === 'FULL_ANONYMOUS'
          ? t('pulse.anonymityFullNotice')
          : t('pulse.anonymityDivisionNotice')}
        <br />{t('pulse.deadline')}: {new Date(survey.closeAt).toLocaleDateString(locale)}
      </div>

      {/* Questions */}
      <div className="space-y-6">
        {survey.questions.map((q, i) => (
          <QuestionCard key={q.id} question={q} index={i} value={answers[q.id]} onAnswer={setAnswer} />
        ))}
      </div>

      {/* Submit */}
      <div className="flex justify-end">
        <button onClick={handleSubmit} disabled={submitting || !allRequiredAnswered}
          className={`flex items-center gap-2 px-6 py-2.5 ${BUTTON_VARIANTS.primary} rounded-lg text-sm font-medium disabled:opacity-50`}>
          <Send className="w-4 h-4" />
          {submitting ? t('pulse.submitting') : t('pulse.submitResponse')}
        </button>
      </div>
    </div>
  )
}
