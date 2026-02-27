'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 징계 상세 (Client)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Gavel, User, FileText, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'

// ─── Label Maps ──────────────────────────────────────────

const DISCIPLINARY_TYPE_LABELS: Record<string, string> = {
  VERBAL_WARNING: '구두경고',
  WRITTEN_WARNING: '서면경고',
  REPRIMAND: '견책',
  SUSPENSION: '정직',
  PAY_CUT: '감봉',
  DEMOTION: '강등',
  TERMINATION: '해고',
}

const DISCIPLINARY_CATEGORY_LABELS: Record<string, string> = {
  ATTENDANCE: '근태',
  SAFETY: '안전',
  QUALITY: '품질',
  CONDUCT: '행동',
  POLICY_VIOLATION: '정책위반',
  MISCONDUCT: '비위',
  HARASSMENT: '괴롭힘',
  FRAUD: '사기',
  OTHER: '기타',
}

const STATUS_LABELS: Record<string, string> = {
  DISCIPLINE_ACTIVE: '활성',
  DISCIPLINE_EXPIRED: '만료',
  DISCIPLINE_OVERTURNED: '번복',
}

const APPEAL_LABELS: Record<string, string> = {
  NONE: '없음',
  FILED: '접수',
  UNDER_REVIEW: '검토중',
  UPHELD: '유지',
  OVERTURNED: '번복',
}

const STATUS_BADGE_STYLES: Record<string, string> = {
  DISCIPLINE_ACTIVE: 'bg-[#E8F5E9] text-[#2E7D32]',
  DISCIPLINE_EXPIRED: 'bg-[#F5F5F5] text-[#999]',
  DISCIPLINE_OVERTURNED: 'bg-[#FFF3E0] text-[#E65100]',
}

const APPEAL_BADGE_STYLES: Record<string, string> = {
  NONE: 'bg-[#F5F5F5] text-[#999]',
  FILED: 'bg-[#E3F2FD] text-[#1565C0]',
  UNDER_REVIEW: 'bg-[#FFF3E0] text-[#E65100]',
  UPHELD: 'bg-[#FFEBEE] text-[#C62828]',
  OVERTURNED: 'bg-[#E8F5E9] text-[#2E7D32]',
}

// ─── Types ───────────────────────────────────────────────

interface DisciplinaryDetail {
  id: string
  actionType: string
  category: string
  incidentDate: string
  description: string
  status: string
  appealStatus: string
  appealDate: string | null
  appealText: string | null
  appealResult: string | null
  evidenceKeys: string[]
  committeeDate: string | null
  committeeMembers: string[]
  decision: string | null
  decisionDate: string | null
  suspensionStart: string | null
  suspensionEnd: string | null
  validMonths: number | null
  expiresAt: string | null
  salaryReductionRate: number | null
  salaryReductionMonths: number | null
  employee: {
    id: string
    name: string
    employeeNo: string
    department: { id: string; name: string } | null
    jobGrade: { id: string; name: string } | null
  }
  issuer: { id: string; name: string } | null
  demotionGrade: { id: string; name: string } | null
}

interface Props {
  user: SessionUser
  id: string
}

// ─── Component ───────────────────────────────────────────

export default function DisciplineDetailClient({ user, id }: Props) {
  const router = useRouter()
  const [data, setData] = useState<DisciplinaryDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [appealText, setAppealText] = useState('')
  const [appealSubmitting, setAppealSubmitting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<DisciplinaryDetail>(`/api/v1/disciplinary/${id}`)
      setData(res.data)
    } catch {
      /* silently handle */
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  const handleAppeal = async () => {
    if (!appealText.trim()) return
    setAppealSubmitting(true)
    try {
      await apiClient.put(`/api/v1/disciplinary/${id}/appeal`, {
        appealText: appealText.trim(),
      })
      await fetchData()
      setAppealText('')
    } catch {
      /* silently handle */
    } finally {
      setAppealSubmitting(false)
    }
  }

  void user

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] p-6 flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-[#999]">
          <div className="w-5 h-5 border-2 border-[#E8E8E8] border-t-[#00C853] rounded-full animate-spin" />
          데이터를 불러오는 중...
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] p-6">
        <div className="text-center text-sm text-[#999] py-12">
          징계 기록을 찾을 수 없습니다.
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/discipline')}
          className="p-2 border border-[#E8E8E8] rounded-lg hover:bg-[#FAFAFA] transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-[#666]" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#FFEBEE] rounded-lg flex items-center justify-center">
            <Gavel className="w-5 h-5 text-[#F44336]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#333]" style={{ letterSpacing: '-0.02em' }}>
              징계 상세
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${STATUS_BADGE_STYLES[data.status] ?? 'bg-[#F5F5F5] text-[#999]'}`}>
                {STATUS_LABELS[data.status] ?? data.status}
              </span>
              <span className="text-xs text-[#999]">
                {DISCIPLINARY_TYPE_LABELS[data.actionType] ?? data.actionType}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 65/35 Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
        {/* Left Panel: Detail */}
        <div className="space-y-6">
          {/* Info Card */}
          <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
            <h2 className="text-base font-bold text-[#333] mb-4" style={{ letterSpacing: '-0.02em' }}>
              징계 정보
            </h2>
            <div className="grid grid-cols-2 gap-y-4 gap-x-6">
              <InfoItem label="대상 사원" value={data.employee.name} />
              <InfoItem label="부서" value={data.employee.department?.name ?? '-'} />
              <InfoItem label="직급" value={data.employee.jobGrade?.name ?? '-'} />
              <InfoItem label="징계유형" value={DISCIPLINARY_TYPE_LABELS[data.actionType] ?? data.actionType} />
              <InfoItem label="분류" value={DISCIPLINARY_CATEGORY_LABELS[data.category] ?? data.category} />
              <InfoItem label="사건일" value={format(new Date(data.incidentDate), 'yyyy-MM-dd')} />
              <InfoItem label="유효기간" value={data.validMonths ? `${data.validMonths}개월` : '-'} />
              <InfoItem label="만료일" value={data.expiresAt ? format(new Date(data.expiresAt), 'yyyy-MM-dd') : '-'} />
              {data.issuer && <InfoItem label="발행자" value={data.issuer.name} />}
            </div>
          </div>

          {/* Description */}
          <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
            <h2 className="text-base font-bold text-[#333] mb-3 flex items-center gap-2" style={{ letterSpacing: '-0.02em' }}>
              <FileText className="w-4 h-4 text-[#666]" />
              징계 사유
            </h2>
            <p className="text-sm text-[#333] leading-relaxed whitespace-pre-wrap">
              {data.description}
            </p>
          </div>

          {/* Evidence */}
          {data.evidenceKeys && data.evidenceKeys.length > 0 && (
            <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
              <h2 className="text-base font-bold text-[#333] mb-3" style={{ letterSpacing: '-0.02em' }}>
                증거자료
              </h2>
              <div className="space-y-1.5">
                {data.evidenceKeys.map((key, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm text-[#2196F3]">
                    <FileText className="w-4 h-4" />
                    <span className="truncate">{key}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Committee */}
          {(data.committeeDate || (data.committeeMembers && data.committeeMembers.length > 0)) && (
            <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
              <h2 className="text-base font-bold text-[#333] mb-4" style={{ letterSpacing: '-0.02em' }}>
                징계위원회
              </h2>
              <div className="grid grid-cols-2 gap-y-3 gap-x-6">
                {data.committeeDate && (
                  <InfoItem label="위원회 일자" value={format(new Date(data.committeeDate), 'yyyy-MM-dd')} />
                )}
                {data.decisionDate && (
                  <InfoItem label="의결일" value={format(new Date(data.decisionDate), 'yyyy-MM-dd')} />
                )}
                {data.committeeMembers && data.committeeMembers.length > 0 && (
                  <div className="col-span-2">
                    <span className="text-xs text-[#999]">위원</span>
                    <p className="text-sm text-[#333]">{data.committeeMembers.join(', ')}</p>
                  </div>
                )}
                {data.decision && (
                  <div className="col-span-2">
                    <span className="text-xs text-[#999]">의결 내용</span>
                    <p className="text-sm text-[#333] whitespace-pre-wrap">{data.decision}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Conditional: Suspension */}
          {data.suspensionStart && (
            <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
              <h2 className="text-base font-bold text-[#333] mb-4" style={{ letterSpacing: '-0.02em' }}>
                정직 기간
              </h2>
              <div className="grid grid-cols-2 gap-y-3 gap-x-6">
                <InfoItem label="시작일" value={format(new Date(data.suspensionStart), 'yyyy-MM-dd')} />
                {data.suspensionEnd && (
                  <InfoItem label="종료일" value={format(new Date(data.suspensionEnd), 'yyyy-MM-dd')} />
                )}
              </div>
            </div>
          )}

          {/* Conditional: Salary Reduction */}
          {data.salaryReductionRate !== null && data.salaryReductionRate !== undefined && (
            <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
              <h2 className="text-base font-bold text-[#333] mb-4" style={{ letterSpacing: '-0.02em' }}>
                감봉 정보
              </h2>
              <div className="grid grid-cols-2 gap-y-3 gap-x-6">
                <InfoItem label="감봉률" value={`${Number(data.salaryReductionRate)}%`} />
                {data.salaryReductionMonths && (
                  <InfoItem label="감봉 기간" value={`${data.salaryReductionMonths}개월`} />
                )}
              </div>
            </div>
          )}

          {/* Conditional: Demotion */}
          {data.demotionGrade && (
            <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
              <h2 className="text-base font-bold text-[#333] mb-4" style={{ letterSpacing: '-0.02em' }}>
                강등 정보
              </h2>
              <InfoItem label="강등 직급" value={data.demotionGrade.name} />
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div className="space-y-6">
          {/* Employee Summary */}
          <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#E3F2FD] rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-[#1565C0]" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#333]">{data.employee.name}</p>
                <p className="text-xs text-[#999]">{data.employee.employeeNo}</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#999]">부서</span>
                <span className="text-[#333]">{data.employee.department?.name ?? '-'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#999]">직급</span>
                <span className="text-[#333]">{data.employee.jobGrade?.name ?? '-'}</span>
              </div>
            </div>
          </div>

          {/* Appeal Section */}
          <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
            <h3 className="text-base font-bold text-[#333] mb-4 flex items-center gap-2" style={{ letterSpacing: '-0.02em' }}>
              <AlertTriangle className="w-4 h-4 text-[#FF9800]" />
              이의신청
            </h3>

            {data.appealStatus === 'NONE' && (
              <div className="space-y-3">
                <textarea
                  value={appealText}
                  onChange={(e) => setAppealText(e.target.value)}
                  rows={4}
                  placeholder="이의신청 사유를 입력해주세요..."
                  className="w-full px-3 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-[#2196F3] resize-none"
                />
                <button
                  onClick={handleAppeal}
                  disabled={!appealText.trim() || appealSubmitting}
                  className="w-full px-4 py-2 text-sm font-medium bg-[#FF9800] hover:bg-[#F57C00] text-white rounded-lg transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {appealSubmitting ? '접수 중...' : '이의신청'}
                </button>
              </div>
            )}

            {data.appealStatus === 'FILED' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 text-xs font-medium rounded ${APPEAL_BADGE_STYLES.FILED}`}>
                    {APPEAL_LABELS.FILED}
                  </span>
                  {data.appealDate && (
                    <span className="text-xs text-[#999]">
                      {format(new Date(data.appealDate), 'yyyy-MM-dd')}
                    </span>
                  )}
                </div>
                {data.appealText && (
                  <p className="text-sm text-[#333] whitespace-pre-wrap">{data.appealText}</p>
                )}
              </div>
            )}

            {data.appealStatus === 'UNDER_REVIEW' && (
              <div className="space-y-3">
                <span className={`px-2 py-1 text-xs font-medium rounded ${APPEAL_BADGE_STYLES.UNDER_REVIEW}`}>
                  {APPEAL_LABELS.UNDER_REVIEW}
                </span>
                {data.appealText && (
                  <p className="text-sm text-[#333] whitespace-pre-wrap">{data.appealText}</p>
                )}
              </div>
            )}

            {(data.appealStatus === 'UPHELD' || data.appealStatus === 'OVERTURNED') && (
              <div className="space-y-3">
                <span className={`px-2 py-1 text-xs font-medium rounded ${APPEAL_BADGE_STYLES[data.appealStatus]}`}>
                  {APPEAL_LABELS[data.appealStatus]}
                </span>
                {data.appealText && (
                  <div className="mt-2">
                    <span className="text-xs text-[#999]">이의신청 내용</span>
                    <p className="text-sm text-[#333] whitespace-pre-wrap">{data.appealText}</p>
                  </div>
                )}
                {data.appealResult && (
                  <div className="mt-2">
                    <span className="text-xs text-[#999]">심사 결과</span>
                    <p className="text-sm text-[#333] whitespace-pre-wrap">{data.appealResult}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Info Item Helper ────────────────────────────────────

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-[#999]">{label}</span>
      <p className="text-sm text-[#333] mt-0.5">{value}</p>
    </div>
  )
}
