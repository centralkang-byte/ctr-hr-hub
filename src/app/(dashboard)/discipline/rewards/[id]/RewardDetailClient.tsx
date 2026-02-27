'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 포상 상세 (Client)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Award, User, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'

// ─── Label Maps ──────────────────────────────────────────

const REWARD_TYPE_LABELS: Record<string, string> = {
  COMMENDATION: '표창',
  BONUS_AWARD: '포상금',
  PROMOTION_RECOMMENDATION: '승진추천',
  LONG_SERVICE: '장기근속',
  INNOVATION: '혁신상',
  SAFETY_AWARD: '안전상',
  CTR_VALUE_AWARD: 'CTR 핵심가치상',
  OTHER: '기타',
}

const REWARD_TYPE_BADGE_STYLES: Record<string, string> = {
  COMMENDATION: 'bg-[#E8F5E9] text-[#2E7D32]',
  BONUS_AWARD: 'bg-[#E3F2FD] text-[#1565C0]',
  CTR_VALUE_AWARD: 'bg-[#F3E5F5] text-[#7B1FA2]',
  LONG_SERVICE: 'bg-[#FFF3E0] text-[#E65100]',
  INNOVATION: 'bg-[#E8F5E9] text-[#00C853]',
  SAFETY_AWARD: 'bg-[#E3F2FD] text-[#2196F3]',
  PROMOTION_RECOMMENDATION: 'bg-[#E8F5E9] text-[#2E7D32]',
  OTHER: 'bg-[#F5F5F5] text-[#999]',
}

const CTR_VALUE_LABELS: Record<string, string> = {
  CHALLENGE: '도전',
  TRUST: '신뢰',
  RESPONSIBILITY: '책임',
  RESPECT: '존중',
}

const CTR_VALUE_BADGE_STYLES: Record<string, string> = {
  CHALLENGE: 'bg-[#FFEBEE] text-[#C62828]',
  TRUST: 'bg-[#E3F2FD] text-[#1565C0]',
  RESPONSIBILITY: 'bg-[#FFF3E0] text-[#E65100]',
  RESPECT: 'bg-[#F3E5F5] text-[#7B1FA2]',
}

// ─── Types ───────────────────────────────────────────────

interface RewardDetail {
  id: string
  rewardType: string
  title: string
  description: string | null
  amount: number | null
  awardedDate: string
  documentKey: string | null
  ctrValue: string | null
  serviceYears: number | null
  createdAt: string
  employee: {
    id: string
    name: string
    employeeNo: string
    department: { id: string; name: string } | null
    jobGrade: { id: string; name: string } | null
  }
  issuer: { id: string; name: string } | null
}

interface Props {
  user: SessionUser
  id: string
}

// ─── Component ───────────────────────────────────────────

export default function RewardDetailClient({ user, id }: Props) {
  const router = useRouter()
  const [data, setData] = useState<RewardDetail | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<RewardDetail>(`/api/v1/rewards/${id}`)
      setData(res.data)
    } catch {
      /* silently handle */
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

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
          포상 기록을 찾을 수 없습니다.
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/discipline/rewards')}
          className="p-2 border border-[#E8E8E8] rounded-lg hover:bg-[#FAFAFA] transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-[#666]" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#E8F5E9] rounded-lg flex items-center justify-center">
            <Award className="w-5 h-5 text-[#00C853]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#333]" style={{ letterSpacing: '-0.02em' }}>
              포상 상세
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${REWARD_TYPE_BADGE_STYLES[data.rewardType] ?? 'bg-[#F5F5F5] text-[#999]'}`}>
                {REWARD_TYPE_LABELS[data.rewardType] ?? data.rewardType}
              </span>
              {data.rewardType === 'CTR_VALUE_AWARD' && data.ctrValue && (
                <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${CTR_VALUE_BADGE_STYLES[data.ctrValue] ?? 'bg-[#F5F5F5] text-[#999]'}`}>
                  {CTR_VALUE_LABELS[data.ctrValue] ?? data.ctrValue}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 65/35 Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
        {/* Left Panel */}
        <div className="space-y-6">
          {/* Reward Info */}
          <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
            <h2 className="text-base font-bold text-[#333] mb-4" style={{ letterSpacing: '-0.02em' }}>
              포상 정보
            </h2>
            <div className="grid grid-cols-2 gap-y-4 gap-x-6">
              <InfoItem label="포상명" value={data.title} />
              <InfoItem label="포상유형" value={REWARD_TYPE_LABELS[data.rewardType] ?? data.rewardType} />
              <InfoItem label="대상 사원" value={data.employee.name} />
              <InfoItem label="부서" value={data.employee.department?.name ?? '-'} />
              <InfoItem label="직급" value={data.employee.jobGrade?.name ?? '-'} />
              <InfoItem
                label="수여일"
                value={format(new Date(data.awardedDate), 'yyyy-MM-dd')}
              />
              <InfoItem
                label="금액"
                value={
                  data.amount !== null && data.amount !== undefined
                    ? `${Number(data.amount).toLocaleString()}원`
                    : '-'
                }
              />
              {data.issuer && <InfoItem label="수여자" value={data.issuer.name} />}
              {data.serviceYears !== null && data.serviceYears !== undefined && (
                <InfoItem label="근속 연수" value={`${data.serviceYears}년`} />
              )}
            </div>

            {/* CTR Value */}
            {data.rewardType === 'CTR_VALUE_AWARD' && data.ctrValue && (
              <div className="mt-4 p-4 bg-[#F3E5F5] rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[#7B1FA2]">CTR 핵심가치:</span>
                  <span className={`px-2 py-1 text-xs font-medium rounded ${CTR_VALUE_BADGE_STYLES[data.ctrValue] ?? ''}`}>
                    {CTR_VALUE_LABELS[data.ctrValue] ?? data.ctrValue}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          {data.description && (
            <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
              <h2 className="text-base font-bold text-[#333] mb-3" style={{ letterSpacing: '-0.02em' }}>
                포상 사유
              </h2>
              <p className="text-sm text-[#333] leading-relaxed whitespace-pre-wrap">
                {data.description}
              </p>
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

          {/* Date Info */}
          <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
            <h3 className="text-base font-bold text-[#333] mb-4 flex items-center gap-2" style={{ letterSpacing: '-0.02em' }}>
              <Calendar className="w-4 h-4 text-[#666]" />
              일자 정보
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#999]">수여일</span>
                <span className="text-[#333]">{format(new Date(data.awardedDate), 'yyyy-MM-dd')}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#999]">등록일</span>
                <span className="text-[#333]">{format(new Date(data.createdAt), 'yyyy-MM-dd')}</span>
              </div>
            </div>
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
