'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — CandidateTimeline
// B4: 후보자 지원 히스토리 타임라인
// ═══════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import {
  CheckCircle2, Clock, Briefcase,
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
  APPLIED: 'bg-muted border-border text-muted-foreground',
  SCREENING: 'bg-indigo-500/15 border-indigo-200 text-primary/90',
  INTERVIEW_1: 'bg-primary/10 border-primary/20 text-primary',
  INTERVIEW_2: 'bg-primary/10 border-primary/20 text-primary',
  FINAL: 'bg-amber-500/15 border-amber-300 text-amber-700',
  OFFER: 'bg-primary/10 border-emerald-200 text-emerald-700',
  HIRED: 'bg-emerald-500/15 border-emerald-300 text-emerald-800',
  REJECTED: 'bg-destructive/10 border-destructive/20 text-destructive',
  pool_entry: 'bg-indigo-500/15 border-indigo-200 text-primary/90',
  default: 'bg-card border-border text-muted-foreground',
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
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        히스토리 로딩 중...
      </div>
    )
  }

  if (!data || data.events.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        이력이 없습니다.
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        지원 히스토리
      </p>
      <div className="relative">
        {/* 세로 연결선 */}
        <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

        <div className="space-y-3">
          {data.events.map((event, _idx) => {
            const colorClass =
              EVENT_COLORS[event.label] ?? EVENT_COLORS[event.type] ?? EVENT_COLORS.default
//             const isLast = idx === data.events.length - 1

            return (
              <div key={event.id} className="relative pl-9 pb-1">
                {/* 아이콘 노드 */}
                <div
                  className={`absolute left-0 top-0.5 w-8 h-8 rounded-full border-2 flex items-center justify-center z-10 ${colorClass}`}
                >
                  {EVENT_ICONS[event.type] ?? <Briefcase size={14} />}
                </div>

                {/* 이벤트 카드 */}
                <div className="bg-card rounded-lg border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {STAGE_LABELS[event.label] ?? event.label}
                      </p>
                      {event.postingTitle && (
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Building2 size={11} />
                          {event.companyName && `${event.companyName} · `}{event.postingTitle}
                        </p>
                      )}
                      {event.description && (
                        <p className="text-xs text-muted-foreground mt-1">{event.description}</p>
                      )}
                      {event.score !== undefined && event.score !== null && (
                        <p className="text-xs text-primary/90 mt-1 font-medium">
                          AI 스크리닝 점수: {event.score}점
                        </p>
                      )}
                    </div>
                    <time className="text-xs text-muted-foreground flex-shrink-0">
                      {new Date(event.timestamp).toLocaleDateString('ko-KR', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                      })}
                    </time>
                  </div>
                  {event.isCurrent && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-primary/90 font-medium">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
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
