'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Users, Send, CheckCircle2 } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { BUTTON_VARIANTS } from '@/lib/styles'

// ─── Peer Review Questions ──────────────────────────────

const PEER_QUESTIONS = [
  { key: 'collaboration', label: '협업 및 팀워크', desc: '동료와 적극적으로 소통하고 팀 목표 달성에 기여하는 정도' },
  { key: 'communication', label: '소통 능력', desc: '명확하고 효과적으로 의사소통하는 능력' },
  { key: 'reliability', label: '신뢰성', desc: '맡은 역할과 약속을 성실히 이행하는 정도' },
  { key: 'expertise', label: '전문성', desc: '담당 업무에 대한 전문 지식과 역량 수준' },
  { key: 'initiative', label: '주도성', desc: '능동적으로 과제를 발굴하고 해결하는 정도' },
  { key: 'respect', label: '존중', desc: '다양한 의견을 경청하고 상호 존중하는 태도' },
  { key: 'growth', label: '성장 의지', desc: '지속적으로 학습하고 발전하려는 의지' },
  { key: 'impact', label: '업무 영향력', desc: '업무 결과가 조직 성과에 미치는 영향' },
]

const SCORE_LABELS = ['매우 부족', '부족', '보통', '우수', '탁월']

// ─── Component ───────────────────────────────────────────

export default function PeerEvalFormClient() {
  const { nominationId } = useParams<{ nominationId: string }>()
  const router = useRouter()

  const [scores, setScores] = useState<Record<string, number>>({})
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const setScore = (key: string, value: number) => {
    setScores((prev) => ({ ...prev, [key]: value }))
  }

  const allScored = PEER_QUESTIONS.every((q) => scores[q.key] != null)
  const avgScore = allScored
    ? Math.round((Object.values(scores).reduce((s, v) => s + v, 0) / PEER_QUESTIONS.length) * 100) / 100
    : 0

  const handleSubmit = async () => {
    if (!allScored || comment.length < 10) return
    setSubmitting(true)
    try {
      await apiClient.post(`/api/v1/peer-review/my-reviews/${nominationId}`, {
        competencyDetail: scores,
        comment,
        competencyScore: avgScore,
      })
      setSubmitted(true)
    } catch { /* ignore */ }
    setSubmitting(false)
  }

  if (submitted) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <CheckCircle2 className="w-16 h-16 text-[#00C853]" />
        <h2 className="text-xl font-bold text-[#1A1A1A]">동료 평가가 제출되었습니다</h2>
        <p className="text-sm text-[#666]">소중한 피드백 감사합니다.</p>
        <button onClick={() => router.push('/performance/peer-review')}
          className={`px-4 py-2 ${BUTTON_VARIANTS.primary} rounded-lg text-sm font-medium`}>
          돌아가기
        </button>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/performance/peer-review')} className="p-1 hover:bg-[#F5F5F5] rounded-lg">
          <ArrowLeft className="w-5 h-5 text-[#666]" />
        </button>
        <Users className="w-6 h-6 text-[#00C853]" />
        <h1 className="text-2xl font-bold text-[#1A1A1A]">동료 평가 작성</h1>
      </div>

      <div className="bg-[#E0E7FF] rounded-xl border border-[#C7D2FE] p-4 text-sm text-[#4338CA]">
        동료 평가는 익명으로 집계됩니다. 솔직하고 건설적인 피드백을 부탁드립니다.
      </div>

      {/* Questions */}
      <div className="space-y-4">
        {PEER_QUESTIONS.map((q) => (
          <div key={q.key} className="bg-white rounded-xl border border-[#E8E8E8] p-5">
            <h3 className="text-sm font-semibold text-[#1A1A1A]">{q.label}</h3>
            <p className="text-xs text-[#666] mt-1 mb-3">{q.desc}</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((v) => (
                <button key={v} onClick={() => setScore(q.key, v)}
                  className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                    scores[q.key] === v
                      ? 'bg-[#00C853] text-white border-[#00C853]'
                      : 'bg-white text-[#555] border-[#D4D4D4] hover:bg-[#FAFAFA]'
                  }`}>
                  <div>{v}</div>
                  <div className="text-xs mt-0.5 opacity-80">{SCORE_LABELS[v - 1]}</div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Overall Score Display */}
      {allScored && (
        <div className="bg-[#E8F5E9] rounded-xl border border-[#00C853]/20 p-4 text-center">
          <p className="text-xs text-[#666]">종합 점수</p>
          <p className="text-3xl font-bold text-[#00C853]">{avgScore} <span className="text-sm text-[#666]">/ 5.0</span></p>
        </div>
      )}

      {/* Comment */}
      <div className="bg-white rounded-xl border border-[#E8E8E8] p-5">
        <h3 className="text-sm font-semibold text-[#1A1A1A] mb-2">종합 코멘트 <span className="text-[#EF4444]">*</span></h3>
        <p className="text-xs text-[#666] mb-3">동료의 강점과 발전 가능성에 대한 구체적인 피드백을 남겨주세요. (최소 10자)</p>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="건설적인 피드백을 작성해 주세요..."
          rows={5}
          className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10 placeholder:text-[#999]"
        />
        <p className="text-xs text-[#999] mt-1 text-right">{comment.length}자</p>
      </div>

      {/* Submit */}
      <div className="flex justify-end">
        <button onClick={handleSubmit} disabled={submitting || !allScored || comment.length < 10}
          className={`flex items-center gap-2 px-6 py-2.5 ${BUTTON_VARIANTS.primary} rounded-lg text-sm font-medium disabled:opacity-50`}>
          <Send className="w-4 h-4" />
          {submitting ? '제출 중...' : '평가 제출'}
        </button>
      </div>
    </div>
  )
}
