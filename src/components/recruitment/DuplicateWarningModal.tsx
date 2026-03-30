'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 후보자 중복 경고 모달
// B4: Task 7 — 중복 감지 + 경고 UI
// ═══════════════════════════════════════════════════════════

import { AlertTriangle, X, UserCheck, ArrowRight } from 'lucide-react'
import { MODAL_STYLES } from '@/lib/styles'

interface DuplicateMatch {
  applicantId: string
  name: string
  email: string
  phone: string | null
  matchType: 'email' | 'phone' | 'name_dob'
  matchScore: number
  applicationCount: number
  lastApplicationAt: string | null
}

interface Props {
  matches: DuplicateMatch[]
  onProceed: () => void
  onCancel: () => void
}

const MATCH_TYPE_LABELS: Record<string, string> = {
  email: '이메일 일치',
  phone: '전화번호 일치',
  name_dob: '이름 + 생년월일 일치',
}

const MATCH_TYPE_COLORS: Record<string, string> = {
  email: 'bg-red-100 text-red-700',
  phone: 'bg-amber-100 text-amber-700',
  name_dob: 'bg-indigo-100 text-primary/90',
}

export default function DuplicateWarningModal({ matches, onProceed, onCancel }: Props) {
  return (
    <div className={MODAL_STYLES.container}>
      <div className={MODAL_STYLES.content.md}>
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertTriangle size={20} className="text-amber-700" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">중복 후보자 감지</h2>
              <p className="text-xs text-[#999]">동일한 후보자가 이미 존재할 수 있습니다.</p>
            </div>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-muted">
            <X size={18} className="text-[#666]" />
          </button>
        </div>

        {/* 매칭 목록 */}
        <div className="p-6 space-y-3 max-h-72 overflow-y-auto">
          {matches.map((match) => (
            <div
              key={match.applicantId}
              className="border border-border rounded-xl p-4 space-y-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <UserCheck size={15} className="text-primary/90" />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-foreground">{match.name}</p>
                    <p className="text-xs text-[#666]">{match.email}</p>
                    {match.phone && <p className="text-xs text-[#999]">{match.phone}</p>}
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${MATCH_TYPE_COLORS[match.matchType]}`}>
                  {MATCH_TYPE_LABELS[match.matchType]}
                </span>
              </div>

              <div className="flex items-center gap-4 text-xs text-[#888] pt-1 border-t border-border">
                <span>총 지원 이력: {match.applicationCount}건</span>
                {match.lastApplicationAt && (
                  <span>
                    최근 지원: {new Date(match.lastApplicationAt).toLocaleDateString('ko-KR')}
                  </span>
                )}
                <span className="font-medium text-primary/90">
                  유사도 {Math.round(match.matchScore * 100)}%
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* 안내 */}
        <div className="mx-6 mb-4 p-3 bg-amber-100 rounded-lg">
          <p className="text-xs text-amber-700">
            중복 후보자를 등록하면 시스템 내 데이터가 분산될 수 있습니다.
            기존 후보자를 확인하거나, 새 후보자로 계속 진행하세요.
          </p>
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-end gap-3 p-6 pt-0">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-border rounded-lg text-sm text-[#555] hover:bg-background"
          >
            취소
          </button>
          <button
            onClick={onProceed}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-sm font-medium"
          >
            <ArrowRight size={14} />
            그래도 신규 등록
          </button>
        </div>
      </div>
    </div>
  )
}
