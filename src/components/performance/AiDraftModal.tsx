'use client'

import { useState } from 'react'
import { X, Sparkles, AlertTriangle, CheckCircle2, Trash2 } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { BUTTON_VARIANTS,  MODAL_STYLES } from '@/lib/styles'

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
      alert('AI 초안 생성에 실패했습니다. 잠시 후 다시 시도하세요.')
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
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#E8E8E8]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#4338CA]" />
            <h2 className="text-lg font-semibold text-[#1A1A1A]">AI 평가 초안 생성</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-[#F5F5F5] rounded-lg">
            <X className="w-4 h-4 text-[#666]" />
          </button>
        </div>

        {/* Disclaimer */}
        <div className="mx-5 mt-4 p-3 bg-[#E0E7FF] rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-[#4338CA] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-[#4338CA]">
            이 초안은 AI가 생성한 참고 자료이며, 매니저의 검토와 수정이 필요합니다.
            <strong> AI 추천 등급은 최종 결정이 아닙니다.</strong>
          </p>
        </div>

        <div className="p-5">
          {!generated ? (
            <div className="text-center py-8">
              <Sparkles className="w-12 h-12 text-[#E0E7FF] mx-auto mb-3" />
              <p className="text-sm text-[#666] mb-6">
                목표 달성률, 원온원 기록, BEI 점수를 분석하여 평가 초안을 생성합니다.
              </p>
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#4338CA] hover:bg-[#3730A3] text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <span className="animate-spin">⟳</span>
                    생성 중... (약 5초 소요)
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    AI 초안 생성
                  </>
                )}
              </button>
            </div>
          ) : draft ? (
            <div className="space-y-4">
              {/* 입력 데이터 요약 */}
              <div className="bg-[#FAFAFA] rounded-lg p-3 text-xs text-[#666] flex gap-3">
                <span>목표 {draft.inputSummary.goalCount}개</span>
                <span>원온원 {draft.inputSummary.oneOnOneCount}건</span>
                <span>{draft.inputSummary.hasPrevEval ? '전기 평가 참조' : '전기 평가 없음'}</span>
              </div>

              {/* 업적 평가 */}
              <div>
                <label className="text-xs font-semibold text-[#333] mb-1 block">업적 평가</label>
                <p className="text-sm text-[#333] bg-[#FAFAFA] rounded-lg p-3 whitespace-pre-wrap">
                  {draft.draftContent.performanceComment}
                </p>
              </div>

              {/* 역량 평가 (있을 때만) */}
              {draft.draftContent.competencyComment && (
                <div>
                  <label className="text-xs font-semibold text-[#333] mb-1 block">역량 평가</label>
                  <p className="text-sm text-[#333] bg-[#FAFAFA] rounded-lg p-3 whitespace-pre-wrap">
                    {draft.draftContent.competencyComment}
                  </p>
                </div>
              )}

              {/* 강점 / 개발 영역 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#047857] mb-1 block">강점</label>
                  <ul className="space-y-1">
                    {draft.draftContent.strengths.map((s, i) => (
                      <li key={i} className="text-xs text-[#333] flex items-start gap-1">
                        <span className="text-[#00C853]">•</span> {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#B45309] mb-1 block">개발 영역</label>
                  <ul className="space-y-1">
                    {draft.draftContent.developmentAreas.map((d, i) => (
                      <li key={i} className="text-xs text-[#333] flex items-start gap-1">
                        <span className="text-[#F59E0B]">•</span> {d}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* 종합 소견 */}
              <div>
                <label className="text-xs font-semibold text-[#333] mb-1 block">종합 소견</label>
                <p className="text-sm text-[#333] bg-[#FAFAFA] rounded-lg p-3 whitespace-pre-wrap">
                  {draft.draftContent.overallOpinion}
                </p>
              </div>

              {/* 추천 등급 (흐린 색으로) */}
              {draft.draftContent.recommendedGrade && (
                <div className="bg-[#F5F5F5] rounded-lg p-3 flex items-center gap-2">
                  <span className="text-xs text-[#999]">AI 추천 등급 (참고용):</span>
                  <span className="text-sm text-[#999] line-through">
                    {draft.draftContent.recommendedGrade}
                  </span>
                  <span className="text-xs text-[#999]">(매니저가 직접 선택)</span>
                </div>
              )}

              {/* 검토 필요 태그 */}
              {draft.draftContent.reviewNeededTags.length > 0 && (
                <div className="bg-[#FEF3C7] rounded-lg p-3">
                  <p className="text-xs font-semibold text-[#B45309] mb-1">검토 필요 항목</p>
                  <ul className="space-y-0.5">
                    {draft.draftContent.reviewNeededTags.map((tag, i) => (
                      <li key={i} className="text-xs text-[#B45309]">• {tag}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 액션 버튼 */}
              <div className="flex justify-between pt-2">
                <button
                  onClick={onClose}
                  className="flex items-center gap-1.5 px-4 py-2 border border-[#FCA5A5] text-[#DC2626] rounded-lg text-sm hover:bg-[#FEE2E2]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  폐기
                </button>
                <button
                  onClick={handleApply}
                  className={`flex items-center gap-1.5 px-5 py-2 ${BUTTON_VARIANTS.primary} rounded-lg text-sm font-medium`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  초안 적용
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
