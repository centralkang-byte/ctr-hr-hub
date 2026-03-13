'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — CandidateTimeline
// B4: 후보자 지원 히스토리 타임라인
// ═══════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import {
  CheckCircle2, XCircle, Clock, Briefcase,
  Building2, MessageSquare, Star,
} from 'lucide-react'
import { apiClient } from '@/lib/api'

interface TimelineEvent {
  id: string
  type: 'stage_change' | 'interview' | 'offer' | 'note' | 'pool_entry'
  label: string
  description?: string
  postingTitle?: string
  companyName?: string
  score?: number
  timestamp: string
  isCurrent: boolean
}

interface CandidateHistoryData {
  applicantId: string
  applicantName: string
  applicantEmail: string
  events: TimelineEvent[]
}

interface Props {
  applicantId: string
}

const STAGE_LABELS: Record<string, string> = {
  APPLIED: '서류접수', SCREENING: '서류심사', INTERVIEW_1: '1차 면접',
  INTERVIEW_2: '2차 면접', FINAL: '최종 면접', OFFER: '오퍼 발송',
  HIRED: '최종 합격', REJECTED: '불합격',
}

const EVENT_ICONS: Record<string, React.ReactNode> = {
  stage_change: <Briefcase size={14} />,
  interview: <Clock size={14} />,
  offer: <Star size={14} />,
  note: <MessageSquare size={14} />,
  pool_entry: <CheckCircle2 size={14} />,
}

const EVENT_COLORS: Record<string, string> = {
  APPLIED: 'bg-[#F5F5F5] border-[#D4D4D4] text-[#555]',
  SCREENING: 'bg-[#E0E7FF] border-[#C7D2FE] text-[#4338CA]',
  INTERVIEW_1: 'bg-[#DBEAFE] border-[#BFDBFE] text-[#1D4ED8]',
  INTERVIEW_2: 'bg-[#DBEAFE] border-[#BFDBFE] text-[#1D4ED8]',
  FINAL: 'bg-[#FEF3C7] border-[#FCD34D] text-[#B45309]',
  OFFER: 'bg-[#EEF2FF] border-[#A7F3D0] text-[#047857]',
  HIRED: 'bg-[#D1FAE5] border-[#6EE7B7] text-[#065F46]',
  REJECTED: 'bg-[#FEE2E2] border-[#FECACA] text-[#B91C1C]',
  pool_entry: 'bg-[#E0E7FF] border-[#C7D2FE] text-[#4338CA]',
  default: 'bg-white border-[#E8E8E8] text-[#555]',
}

export default function CandidateTimeline({ applicantId }: Props) {
  const [data, setData] = useState<CandidateHistoryData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!applicantId) return
    setLoading(true)
    apiClient.get<CandidateHistoryData>(`/api/v1/recruitment/applicants/${applicantId}/timeline`)
      .then(res => setData(res.data ?? null))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [applicantId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-[#999]">
        히스토리 로딩 중...
      </div>
    )
  }

  if (!data || data.events.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-[#999]">
        이력이 없습니다.
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-[#999] uppercase tracking-wider mb-3">
        지원 히스토리
      </p>
      <div className="relative">
        {/* 세로 연결선 */}
        <div className="absolute left-4 top-0 bottom-0 w-px bg-[#E8E8E8]" />

        <div className="space-y-3">
          {data.events.map((event, idx) => {
            const colorClass =
              EVENT_COLORS[event.label] ?? EVENT_COLORS[event.type] ?? EVENT_COLORS.default
            const isLast = idx === data.events.length - 1

            return (
              <div key={event.id} className="relative pl-9 pb-1">
                {/* 아이콘 노드 */}
                <div
                  className={`absolute left-0 top-0.5 w-8 h-8 rounded-full border-2 flex items-center justify-center z-10 ${colorClass}`}
                >
                  {EVENT_ICONS[event.type] ?? <Briefcase size={14} />}
                </div>

                {/* 이벤트 카드 */}
                <div className="bg-white rounded-lg border border-[#E8E8E8] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#1A1A1A]">
                        {STAGE_LABELS[event.label] ?? event.label}
                      </p>
                      {event.postingTitle && (
                        <p className="text-xs text-[#666] mt-0.5 flex items-center gap-1">
                          <Building2 size={11} />
                          {event.companyName && `${event.companyName} · `}{event.postingTitle}
                        </p>
                      )}
                      {event.description && (
                        <p className="text-xs text-[#888] mt-1">{event.description}</p>
                      )}
                      {event.score !== undefined && event.score !== null && (
                        <p className="text-xs text-[#4338CA] mt-1 font-medium">
                          AI 스크리닝 점수: {event.score}점
                        </p>
                      )}
                    </div>
                    <time className="text-xs text-[#999] flex-shrink-0">
                      {new Date(event.timestamp).toLocaleDateString('ko-KR', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                      })}
                    </time>
                  </div>
                  {event.isCurrent && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-[#4338CA] font-medium">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#4F46E5] animate-pulse" />
                      현재 단계
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
