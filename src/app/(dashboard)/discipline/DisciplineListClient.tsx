'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 징계관리 목록 (Client)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Search, Plus, ChevronLeft, ChevronRight, Gavel, Filter } from 'lucide-react'
import { format } from 'date-fns'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'

// ─── Badge Styles ────────────────────────────────────────

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

interface DisciplinaryRecord {
  id: string
  actionType: string
  category: string
  incidentDate: string
  status: string
  appealStatus: string
  employee: {
    id: string
    name: string
    employeeNo: string
  }
  issuer: {
    id: string
    name: string
  } | null
}

interface Props {
  user: SessionUser
}

const LIMIT = 20

// ─── Component ───────────────────────────────────────────

export default function DisciplineListClient({ user }: Props) {
  const router = useRouter()
  const t = useTranslations('disciplinePage')
  const tCommon = useTranslations('common')

  const [data, setData] = useState<DisciplinaryRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.getList<DisciplinaryRecord>('/api/v1/disciplinary', {
        page,
        limit: LIMIT,
        search: search || undefined,
        status: statusFilter || undefined,
        category: categoryFilter || undefined,
      })
      setData(res.data)
      setTotal(res.pagination.total)
    } catch {
      /* silently handle */
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter, categoryFilter])

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

  void user // used for permission checks in server page

  const CATEGORY_KEYS = ['ATTENDANCE', 'SAFETY', 'QUALITY', 'CONDUCT', 'POLICY_VIOLATION', 'MISCONDUCT', 'HARASSMENT', 'FRAUD', 'OTHER'] as const

  return (
    <div className="min-h-screen bg-[#FAFAFA] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#FFEBEE] rounded-lg flex items-center justify-center">
            <Gavel className="w-5 h-5 text-[#F44336]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#333]" style={{ letterSpacing: '-0.02em' }}>
              {t('title')}
            </h1>
            <p className="text-sm text-[#999]">{tCommon('total')} {total}{tCommon('items')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/discipline/rewards')}
            className="px-4 py-2 text-sm font-medium border border-[#E8E8E8] text-[#333] hover:bg-[#FAFAFA] rounded-lg transition-colors duration-150"
          >
            {t('rewardsManagement')}
          </button>
          <button
            onClick={() => router.push('/discipline/new')}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#00C853] hover:bg-[#00A844] text-white rounded-lg transition-colors duration-150"
          >
            <Plus className="w-4 h-4" />
            {t('registerDiscipline')}
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
              placeholder={t('searchPlaceholder')}
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
              <option value="DISCIPLINE_ACTIVE">{t('statusLabels.DISCIPLINE_ACTIVE')}</option>
              <option value="DISCIPLINE_EXPIRED">{t('statusLabels.DISCIPLINE_EXPIRED')}</option>
              <option value="DISCIPLINE_OVERTURNED">{t('statusLabels.DISCIPLINE_OVERTURNED')}</option>
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setPage(1) }}
              className="px-3 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-[#2196F3] bg-white"
            >
              <option value="">{t('categoryAll')}</option>
              {CATEGORY_KEYS.map((key) => (
                <option key={key} value={key}>{t(`categoryLabels.${key}`)}</option>
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
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">{t('employeeName')}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">{t('employeeNo')}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">{t('disciplineType')}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">{t('disciplineCategory')}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">{t('incidentDate')}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">{tCommon('status')}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">{t('appeal')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-[#999]">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-[#E8E8E8] border-t-[#00C853] rounded-full animate-spin" />
                    {t('loadingData')}
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-[#999]">
                  {t('emptyMessage')}
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => router.push(`/discipline/${row.id}`)}
                  className="border-b border-[#E8E8E8] last:border-b-0 hover:bg-[#FAFAFA] cursor-pointer transition-colors duration-150"
                >
                  <td className="px-4 py-3 text-sm text-[#333] font-medium">
                    {row.employee.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#666]">
                    {row.employee.employeeNo}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#333]">
                    {t(`typeLabels.${row.actionType}`, { defaultValue: row.actionType })}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#333]">
                    {t(`categoryLabels.${row.category}`, { defaultValue: row.category })}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#666]">
                    {format(new Date(row.incidentDate), 'yyyy-MM-dd')}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${STATUS_BADGE_STYLES[row.status] ?? 'bg-[#F5F5F5] text-[#999]'}`}>
                      {t(`statusLabels.${row.status}`, { defaultValue: row.status })}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${APPEAL_BADGE_STYLES[row.appealStatus] ?? 'bg-[#F5F5F5] text-[#999]'}`}>
                      {t(`appealLabels.${row.appealStatus}`, { defaultValue: row.appealStatus })}
                    </span>
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
              {t('paginationInfo', { total, start: (page - 1) * LIMIT + 1, end: Math.min(page * LIMIT, total) })}
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
