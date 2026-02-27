'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 지원자 관리 목록 (Client)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Plus,
  Users,
  Filter,
} from 'lucide-react'
import { format } from 'date-fns'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'

// ─── Constants ──────────────────────────────────────────

const STAGE_LABELS: Record<string, string> = {
  APPLIED: '지원완료',
  SCREENING: '서류심사',
  INTERVIEW_1: '1차면접',
  INTERVIEW_2: '2차면접',
  FINAL: '최종심사',
  OFFER: '오퍼',
  HIRED: '합격',
  REJECTED: '탈락',
}

const STAGE_BADGE_STYLES: Record<string, string> = {
  APPLIED: 'bg-[#F5F5F5] text-[#999]',
  SCREENING: 'bg-[#E3F2FD] text-[#1565C0]',
  INTERVIEW_1: 'bg-[#E3F2FD] text-[#1565C0]',
  INTERVIEW_2: 'bg-[#E3F2FD] text-[#1565C0]',
  FINAL: 'bg-[#FFF3E0] text-[#E65100]',
  OFFER: 'bg-[#E8F5E9] text-[#2E7D32]',
  HIRED: 'bg-[#E8F5E9] text-[#1B5E20] font-bold',
  REJECTED: 'bg-[#FFEBEE] text-[#C62828]',
}

const SOURCE_LABELS: Record<string, string> = {
  DIRECT: '직접지원',
  REFERRAL: '추천',
  AGENCY: '에이전시',
  JOB_BOARD: '잡보드',
  INTERNAL: '내부전환',
}

const SOURCE_BADGE_STYLES: Record<string, string> = {
  DIRECT: 'bg-[#F5F5F5] text-[#666]',
  REFERRAL: 'bg-[#E8F5E9] text-[#2E7D32]',
  AGENCY: 'bg-[#E3F2FD] text-[#1565C0]',
  JOB_BOARD: 'bg-[#FFF3E0] text-[#E65100]',
  INTERNAL: 'bg-[#F3E5F5] text-[#7B1FA2]',
}

const STAGES_ALL = [
  'APPLIED',
  'SCREENING',
  'INTERVIEW_1',
  'INTERVIEW_2',
  'FINAL',
  'OFFER',
  'HIRED',
  'REJECTED',
] as const

const LIMIT = 20

// ─── Types ──────────────────────────────────────────────

interface ApplicantInfo {
  id: string
  name: string
  email: string
  phone: string | null
  source: string
  portfolioUrl: string | null
}

interface ApplicationRecord {
  id: string
  postingId: string
  applicantId: string
  stage: string
  aiScreeningScore: number | null
  aiScreeningSummary: string | null
  rejectionReason: string | null
  offeredSalary: number | null
  offeredDate: string | null
  expectedStartDate: string | null
  appliedAt: string
  updatedAt: string
  applicant: ApplicantInfo
}

interface Props {
  user: SessionUser
  postingId: string
}

// ─── Component ──────────────────────────────────────────

export default function ApplicantListClient({ user, postingId }: Props) {
  const router = useRouter()
  const [data, setData] = useState<ApplicationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [stageFilter, setStageFilter] = useState('')

  void user

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.getList<ApplicationRecord>(
        `/api/v1/recruitment/postings/${postingId}/applicants`,
        {
          page,
          limit: LIMIT,
          search: search || undefined,
          stage: stageFilter || undefined,
        },
      )
      setData(res.data)
      setTotal(res.pagination.total)
    } catch {
      /* silently handle */
    } finally {
      setLoading(false)
    }
  }, [postingId, page, search, stageFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const totalPages = Math.ceil(total / LIMIT)

  const handleSearch = () => {
    setSearch(searchInput)
    setPage(1)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  const getAiScoreDisplay = (score: number | null) => {
    if (score === null || score === undefined) {
      return <span className="text-sm text-[#999]">-</span>
    }
    let colorClass = 'text-[#F44336]'
    if (score >= 80) colorClass = 'text-[#00C853]'
    else if (score >= 50) colorClass = 'text-[#FF9800]'
    return <span className={`text-sm font-medium ${colorClass}`}>{score}점</span>
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/recruitment/${postingId}`)}
            className="p-2 rounded-lg border border-[#E8E8E8] hover:bg-white transition-colors duration-150"
          >
            <ChevronLeft className="w-4 h-4 text-[#666]" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#E3F2FD] rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-[#2196F3]" />
            </div>
            <div>
              <h1
                className="text-xl font-bold text-[#333]"
                style={{ letterSpacing: '-0.02em' }}
              >
                지원자 관리
              </h1>
              <p className="text-sm text-[#999]">
                총 {total}명
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={() => router.push(`/recruitment/${postingId}/applicants/new`)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#00C853] hover:bg-[#00A844] text-white rounded-lg transition-colors duration-150"
        >
          <Plus className="w-4 h-4" />
          지원자 등록
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-[#E8E8E8] rounded-xl p-4 mb-6">
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999]" />
            <input
              type="text"
              placeholder="이름 또는 이메일 검색..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full pl-10 pr-4 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-[#2196F3] transition-colors duration-150"
            />
          </div>
          {/* Stage Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#999]" />
            <select
              value={stageFilter}
              onChange={(e) => {
                setStageFilter(e.target.value)
                setPage(1)
              }}
              className="px-3 py-2 text-sm border border-[#E8E8E8] rounded-lg bg-white focus:outline-none focus:border-[#2196F3] transition-colors duration-150"
            >
              <option value="">전체 단계</option>
              {STAGES_ALL.map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleSearch}
            className="px-4 py-2 text-sm font-medium bg-[#333] text-white rounded-lg hover:bg-[#555] transition-colors duration-150"
          >
            검색
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E8E8E8] rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-2 text-sm text-[#999]">
              <div className="w-4 h-4 border-2 border-[#E8E8E8] border-t-[#00C853] rounded-full animate-spin" />
              데이터를 불러오는 중...
            </div>
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#999]">
            <Users className="w-8 h-8 mb-2" />
            <p className="text-sm">지원자가 없습니다.</p>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E8E8E8]">
                  <th className="text-left px-6 py-3 text-xs font-medium text-[#999] uppercase tracking-wider">
                    이름
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-[#999] uppercase tracking-wider">
                    이메일
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-[#999] uppercase tracking-wider">
                    지원경로
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-[#999] uppercase tracking-wider">
                    AI점수
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-[#999] uppercase tracking-wider">
                    진행단계
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-[#999] uppercase tracking-wider">
                    지원일
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((app) => (
                  <tr
                    key={app.id}
                    onClick={() => router.push(`/recruitment/${postingId}/applicants/${app.id}`)}
                    className="border-b border-[#F5F5F5] hover:bg-[#FAFAFA] cursor-pointer transition-colors duration-150"
                  >
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-[#333]">
                        {app.applicant.name}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-[#666]">
                        {app.applicant.email}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                          SOURCE_BADGE_STYLES[app.applicant.source] ?? 'bg-[#F5F5F5] text-[#999]'
                        }`}
                      >
                        {SOURCE_LABELS[app.applicant.source] ?? app.applicant.source}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {getAiScoreDisplay(app.aiScreeningScore)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                          STAGE_BADGE_STYLES[app.stage] ?? 'bg-[#F5F5F5] text-[#999]'
                        }`}
                      >
                        {STAGE_LABELS[app.stage] ?? app.stage}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-[#666]">
                        {format(new Date(app.appliedAt), 'yyyy-MM-dd')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-[#E8E8E8]">
                <p className="text-xs text-[#999]">
                  총 {total}건 중 {(page - 1) * LIMIT + 1}-
                  {Math.min(page * LIMIT, total)}건
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="p-2 rounded-lg border border-[#E8E8E8] hover:bg-[#FAFAFA] disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
                  >
                    <ChevronLeft className="w-4 h-4 text-[#666]" />
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const startPage = Math.max(
                      1,
                      Math.min(page - 2, totalPages - 4),
                    )
                    const pg = startPage + i
                    if (pg > totalPages) return null
                    return (
                      <button
                        key={pg}
                        onClick={() => setPage(pg)}
                        className={`w-8 h-8 text-sm rounded-lg transition-colors duration-150 ${
                          pg === page
                            ? 'bg-[#333] text-white'
                            : 'text-[#666] hover:bg-[#FAFAFA]'
                        }`}
                      >
                        {pg}
                      </button>
                    )
                  })}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="p-2 rounded-lg border border-[#E8E8E8] hover:bg-[#FAFAFA] disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
                  >
                    <ChevronRight className="w-4 h-4 text-[#666]" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
