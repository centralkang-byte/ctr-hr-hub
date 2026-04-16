'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { X, Sparkles, AlertTriangle, CheckCircle2, Trash2 } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { BUTTON_VARIANTS,  MODAL_STYLES } from '@/lib/styles'
import { toast } from '@/hooks/use-toast'

interface DraftContent {
  performanceComment: string
  competencyComment?: string | null
  strengths: string[]
  developmentAreas: string[]
  overallOpinion: string
  recommendedGrade?: string | null
  reviewNeededTags: string[]
}

interface AiDraftData {
  id: string
  draftContent: DraftContent
  inputSummary: { goalCount: number; oneOnOneCount: number; hasPrevEval: boolean; generatedAt: string }
  status: string
}

interface Props {
  evaluationId: string
  onClose: () => void
  onApply: (draft: DraftContent) => void
}

export default function AiDraftModal({ evaluationId, onClose, onApply }: Props) {
  const t = useTranslations('performance')
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState<AiDraftData | null>(null)
  const [generated, setGenerated] = useState(false)

  const handleGenerate = async () => {
    setLoading(true)
    try {
      const res = await apiClient.post<AiDraftData>(
        `/api/v1/performance/evaluations/${evaluationId}/ai-draft`,
        {},
      )
      setDraft(res.data)
      setGenerated(true)
    } catch {
      toast({ title: t('aiDraft.messages.generateFailed'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleApply = () => {
    if (draft) {
      onApply(draft.draftContent)
      onClose()
    }
  }

  return (
    <div className={MODAL_STYLES.container}>
      <div className="bg-card rounded-xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary/90" />
            <h2 className="text-lg font-semibold text-foreground">{t('aiDraft.title')}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Disclaimer */}
        <div className="mx-5 mt-4 p-3 bg-indigo-500/15 rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-primary/90 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-primary/90">
            {t('aiDraft.disclaimer')}
            <strong> {t('aiDraft.disclaimerBold')}</strong>
          </p>
        </div>

        <div className="p-5">
          {!generated ? (
            <div className="text-center py-8">
              <Sparkles className="w-12 h-12 text-indigo-100 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-6">
                {t('aiDraft.description')}
              </p>
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary/90 hover:bg-indigo-800 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <span className="animate-spin">⟳</span>
                    {t('aiDraft.generating')}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    {t('aiDraft.generateButton')}
                  </>
                )}
              </button>
            </div>
          ) : draft ? (
            <div className="space-y-4">
              {/* 입력 데이터 요약 */}
              <div className="bg-background rounded-lg p-3 text-xs text-muted-foreground flex gap-3">
                <span>{t('aiDraft.goalCount', { count: draft.inputSummary.goalCount })}</span>
                <span>{t('aiDraft.oneOnOneCount', { count: draft.inputSummary.oneOnOneCount })}</span>
                <span>{draft.inputSummary.hasPrevEval ? t('aiDraft.prevEvalRef') : t('aiDraft.noPrevEval')}</span>
              </div>

              {/* 업적 평가 */}
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">{t('aiDraft.performanceEval')}</label>
                <p className="text-sm text-foreground bg-background rounded-lg p-3 whitespace-pre-wrap">
                  {draft.draftContent.performanceComment}
                </p>
              </div>

              {/* 역량 평가 (있을 때만) */}
              {draft.draftContent.competencyComment && (
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">{t('aiDraft.competencyEval')}</label>
                  <p className="text-sm text-foreground bg-background rounded-lg p-3 whitespace-pre-wrap">
                    {draft.draftContent.competencyComment}
                  </p>
                </div>
              )}

              {/* 강점 / 개발 영역 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-emerald-700 mb-1 block">{t('aiDraft.strengths')}</label>
                  <ul className="space-y-1">
                    {draft.draftContent.strengths.map((s, i) => (
                      <li key={i} className="text-xs text-foreground flex items-start gap-1">
                        <span className="text-primary">•</span> {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <label className="text-xs font-semibold text-amber-700 mb-1 block">{t('aiDraft.developmentAreas')}</label>
                  <ul className="space-y-1">
                    {draft.draftContent.developmentAreas.map((d, i) => (
                      <li key={i} className="text-xs text-foreground flex items-start gap-1">
                        <span className="text-amber-500">•</span> {d}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* 종합 소견 */}
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">{t('aiDraft.overallOpinion')}</label>
                <p className="text-sm text-foreground bg-background rounded-lg p-3 whitespace-pre-wrap">
                  {draft.draftContent.overallOpinion}
                </p>
              </div>

              {/* 추천 등급 (흐린 색으로) */}
              {draft.draftContent.recommendedGrade && (
                <div className="bg-muted rounded-lg p-3 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{t('aiDraft.recommendedGradeLabel')}</span>
                  <span className="text-sm text-muted-foreground line-through">
                    {draft.draftContent.recommendedGrade}
                  </span>
                  <span className="text-xs text-muted-foreground">{t('aiDraft.managerSelectsGrade')}</span>
                </div>
              )}

              {/* 검토 필요 태그 */}
              {draft.draftContent.reviewNeededTags.length > 0 && (
                <div className="bg-amber-500/15 rounded-lg p-3">
                  <p className="text-xs font-semibold text-amber-700 mb-1">{t('aiDraft.reviewNeededItems')}</p>
                  <ul className="space-y-0.5">
                    {draft.draftContent.reviewNeededTags.map((tag, i) => (
                      <li key={i} className="text-xs text-amber-700">• {tag}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 액션 버튼 */}
              <div className="flex justify-between pt-2">
                <button
                  onClick={onClose}
                  className="flex items-center gap-1.5 px-4 py-2 border border-red-300 text-destructive rounded-lg text-sm hover:bg-destructive/10"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {t('aiDraft.discard')}
                </button>
                <button
                  onClick={handleApply}
                  className={`flex items-center gap-1.5 px-5 py-2 ${BUTTON_VARIANTS.primary} rounded-lg text-sm font-medium`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {t('aiDraft.applyDraft')}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
