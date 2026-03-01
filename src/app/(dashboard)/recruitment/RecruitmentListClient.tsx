'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 채용공고 목록 (Client)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Search, Plus, ChevronLeft, ChevronRight, Briefcase, Filter } from 'lucide-react'
import { format } from 'date-fns'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'

// ─── Label Maps ──────────────────────────────────────────

const STATUS_KEYS: Record<string, string> = {
  DRAFT: 'statusDRAFT',
  OPEN: 'statusOPEN',
  CLOSED: 'statusCLOSED',
  CANCELLED: 'statusCANCELLED',
}

const STATUS_BADGE_STYLES: Record<string, string> = {
  DRAFT: 'bg-[#F5F5F5] text-[#999]',
  OPEN: 'bg-[#E8F5E9] text-[#2E7D32]',
  CLOSED: 'bg-[#FFF3E0] text-[#E65100]',
  CANCELLED: 'bg-[#FFEBEE] text-[#C62828]',
}

const EMPLOYMENT_TYPE_KEYS: Record<string, string> = {
  FULL_TIME: 'typeFULL_TIME',
  CONTRACT: 'typeCONTRACT',
  DISPATCH: 'typeDISPATCH',
  INTERN: 'typeINTERN',
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
  const t = useTranslations('recruitment')
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
              {t('postings')}
            </h1>
            <p className="text-sm text-[#999]">{t('totalCount', { count: total })}</p>
          </div>
        </div>
        <button
          onClick={() => router.push('/recruitment/new')}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#00C853] hover:bg-[#00A844] text-white rounded-lg transition-colors duration-150"
        >
          <Plus className="w-4 h-4" />
          {t('registerPosting')}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-[#E8E8E8] rounded-xl p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999]" />
            <input
              type="text"
              placeholder={t('searchByTitle')}
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
              <option value="">{t('statusAll')}</option>
              <option value="DRAFT">{t('statusDRAFT')}</option>
              <option value="OPEN">{t('statusOPEN')}</option>
              <option value="CLOSED">{t('statusCLOSED')}</option>
              <option value="CANCELLED">{t('statusCANCELLED')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E8E8E8] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#E8E8E8]">
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">{t('postingTitleCol')}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">{t('department')}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">{t('jobGrade')}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">{t('employmentType')}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">{t('headcountColumn')}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">{t('applicantCountCol')}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">{t('statusCol')}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">{t('registeredDate')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-[#999]">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-[#E8E8E8] border-t-[#00C853] rounded-full animate-spin" />
                    {t('loadingData')}
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-[#999]">
                  {t('noPostings')}
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
                    {EMPLOYMENT_TYPE_KEYS[row.employmentType] ? t(EMPLOYMENT_TYPE_KEYS[row.employmentType]) : row.employmentType}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#333] text-center">
                    {row.headcount}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#2196F3] font-medium text-center">
                    {row._count.applications}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${STATUS_BADGE_STYLES[row.status] ?? 'bg-[#F5F5F5] text-[#999]'}`}>
                      {STATUS_KEYS[row.status] ? t(STATUS_KEYS[row.status]) : row.status}
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
              {t('paginationInfo', { total, from: (page - 1) * LIMIT + 1, to: Math.min(page * LIMIT, total) })}
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
