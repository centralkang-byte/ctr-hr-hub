'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 포상관리 목록 (Client)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Plus, ChevronLeft, ChevronRight, Award, Filter } from 'lucide-react'
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

interface RewardRecord {
  id: string
  rewardType: string
  title: string
  amount: number | null
  awardedDate: string
  ctrValue: string | null
  serviceYears: number | null
  employee: {
    id: string
    name: string
    employeeNo: string
  }
  issuer: { id: string; name: string } | null
}

interface Props {
  user: SessionUser
}

const LIMIT = 20

// ─── Component ───────────────────────────────────────────

export default function RewardsListClient({ user }: Props) {
  const router = useRouter()
  const [data, setData] = useState<RewardRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.getList<RewardRecord>('/api/v1/rewards', {
        page,
        limit: LIMIT,
        search: search || undefined,
        rewardType: typeFilter || undefined,
      })
      setData(res.data)
      setTotal(res.pagination.total)
    } catch {
      /* silently handle */
    } finally {
      setLoading(false)
    }
  }, [page, search, typeFilter])

  useEffect(() => { fetchData() }, [fetchData])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  const totalPages = Math.ceil(total / LIMIT)

  void user

  return (
    <div className="min-h-screen bg-[#FAFAFA] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#E8F5E9] rounded-lg flex items-center justify-center">
            <Award className="w-5 h-5 text-[#00C853]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#333]" style={{ letterSpacing: '-0.02em' }}>
              포상관리
            </h1>
            <p className="text-sm text-[#999]">총 {total}건</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/discipline')}
            className="px-4 py-2 text-sm font-medium border border-[#E8E8E8] text-[#333] hover:bg-[#FAFAFA] rounded-lg transition-colors duration-150"
          >
            징계관리
          </button>
          <button
            onClick={() => router.push('/discipline/rewards/new')}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#00C853] hover:bg-[#00A844] text-white rounded-lg transition-colors duration-150"
          >
            <Plus className="w-4 h-4" />
            포상 등록
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-[#E8E8E8] rounded-xl p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999]" />
            <input
              type="text"
              placeholder="사원명 또는 포상명으로 검색..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-[#2196F3] transition-colors"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#999]" />
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}
              className="px-3 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-[#2196F3] bg-white"
            >
              <option value="">유형 전체</option>
              {Object.entries(REWARD_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E8E8E8] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#E8E8E8]">
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">사원명</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">사번</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">포상유형</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">포상명</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">수여일</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-[#999]">금액</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-[#999]">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-[#E8E8E8] border-t-[#00C853] rounded-full animate-spin" />
                    데이터를 불러오는 중...
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-[#999]">
                  등록된 포상 기록이 없습니다.
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => router.push(`/discipline/rewards/${row.id}`)}
                  className="border-b border-[#E8E8E8] last:border-b-0 hover:bg-[#FAFAFA] cursor-pointer transition-colors duration-150"
                >
                  <td className="px-4 py-3 text-sm text-[#333] font-medium">
                    {row.employee.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#666]">
                    {row.employee.employeeNo}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${REWARD_TYPE_BADGE_STYLES[row.rewardType] ?? 'bg-[#F5F5F5] text-[#999]'}`}>
                        {REWARD_TYPE_LABELS[row.rewardType] ?? row.rewardType}
                      </span>
                      {row.rewardType === 'CTR_VALUE_AWARD' && row.ctrValue && (
                        <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${CTR_VALUE_BADGE_STYLES[row.ctrValue] ?? 'bg-[#F5F5F5] text-[#999]'}`}>
                          {CTR_VALUE_LABELS[row.ctrValue] ?? row.ctrValue}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#333]">
                    {row.title}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#666]">
                    {format(new Date(row.awardedDate), 'yyyy-MM-dd')}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#333] text-right">
                    {row.amount !== null && row.amount !== undefined
                      ? `${Number(row.amount).toLocaleString()}원`
                      : '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#E8E8E8]">
            <p className="text-xs text-[#999]">
              {total}건 중 {(page - 1) * LIMIT + 1}-{Math.min(page * LIMIT, total)}건
            </p>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-[#E8E8E8] hover:bg-[#FAFAFA] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-[#666]" />
              </button>
              <span className="px-3 text-sm text-[#333]">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-[#E8E8E8] hover:bg-[#FAFAFA] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-[#666]" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
