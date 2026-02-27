'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 채용공고 목록 (Client)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Plus, ChevronLeft, ChevronRight, Briefcase, Filter } from 'lucide-react'
import { format } from 'date-fns'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'

// ─── Label Maps ──────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  DRAFT: '초안',
  OPEN: '진행중',
  CLOSED: '마감',
  CANCELLED: '취소',
}

const STATUS_BADGE_STYLES: Record<string, string> = {
  DRAFT: 'bg-[#F5F5F5] text-[#999]',
  OPEN: 'bg-[#E8F5E9] text-[#2E7D32]',
  CLOSED: 'bg-[#FFF3E0] text-[#E65100]',
  CANCELLED: 'bg-[#FFEBEE] text-[#C62828]',
}

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  FULL_TIME: '정규직',
  CONTRACT: '계약직',
  DISPATCH: '파견직',
  INTERN: '인턴',
}

// ─── Types ───────────────────────────────────────────────

interface PostingRecord {
  id: string
  title: string
  status: string
  employmentType: string
  headcount: number
  createdAt: string
  department: { id: string; name: string } | null
  jobGrade: { id: string; name: string } | null
  creator: { id: string; name: string } | null
  _count: { applications: number }
}

interface Props {
  user: SessionUser
}

const LIMIT = 20

// ─── Component ───────────────────────────────────────────

export default function RecruitmentListClient({ user }: Props) {
  const router = useRouter()
  const [data, setData] = useState<PostingRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.getList<PostingRecord>('/api/v1/recruitment/postings', {
        page,
        limit: LIMIT,
        search: search || undefined,
        status: statusFilter || undefined,
      })
      setData(res.data)
      setTotal(res.pagination.total)
    } catch {
      /* silently handle */
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter])

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
          <div className="w-10 h-10 bg-[#E3F2FD] rounded-lg flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-[#2196F3]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#333]" style={{ letterSpacing: '-0.02em' }}>
              채용공고
            </h1>
            <p className="text-sm text-[#999]">총 {total}건</p>
          </div>
        </div>
        <button
          onClick={() => router.push('/recruitment/new')}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#00C853] hover:bg-[#00A844] text-white rounded-lg transition-colors duration-150"
        >
          <Plus className="w-4 h-4" />
          공고 등록
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-[#E8E8E8] rounded-xl p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999]" />
            <input
              type="text"
              placeholder="공고 제목으로 검색..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-[#2196F3] transition-colors"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#999]" />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
              className="px-3 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-[#2196F3] bg-white"
            >
              <option value="">상태 전체</option>
              <option value="DRAFT">초안</option>
              <option value="OPEN">진행중</option>
              <option value="CLOSED">마감</option>
              <option value="CANCELLED">취소</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E8E8E8] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#E8E8E8]">
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">공고제목</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">부서</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">직급</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">고용형태</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">채용인원</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">지원자수</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">상태</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">등록일</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-[#999]">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-[#E8E8E8] border-t-[#00C853] rounded-full animate-spin" />
                    데이터를 불러오는 중...
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-[#999]">
                  등록된 채용 공고가 없습니다.
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => router.push(`/recruitment/${row.id}`)}
                  className="border-b border-[#E8E8E8] last:border-b-0 hover:bg-[#FAFAFA] cursor-pointer transition-colors duration-150"
                >
                  <td className="px-4 py-3 text-sm text-[#333] font-medium">
                    {row.title}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#666]">
                    {row.department?.name ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#666]">
                    {row.jobGrade?.name ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#333]">
                    {EMPLOYMENT_TYPE_LABELS[row.employmentType] ?? row.employmentType}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#333] text-center">
                    {row.headcount}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#2196F3] font-medium text-center">
                    {row._count.applications}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${STATUS_BADGE_STYLES[row.status] ?? 'bg-[#F5F5F5] text-[#999]'}`}>
                      {STATUS_LABELS[row.status] ?? row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#666]">
                    {format(new Date(row.createdAt), 'yyyy-MM-dd')}
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
