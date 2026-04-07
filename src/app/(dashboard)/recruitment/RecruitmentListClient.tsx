'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 채용공고 목록 (Client)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Search, Plus, ChevronLeft, ChevronRight, Briefcase, Filter } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from '@/hooks/use-toast'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import { BUTTON_SIZES, BUTTON_VARIANTS,  TABLE_STYLES } from '@/lib/styles'
import { STATUS_VARIANT } from '@/lib/styles/status'

// ─── Label Maps ──────────────────────────────────────────

const STATUS_KEYS: Record<string, string> = {
  DRAFT: 'statusDRAFT',
  OPEN: 'statusOPEN',
  CLOSED: 'statusCLOSED',
  CANCELLED: 'statusCANCELLED',
}

const STATUS_BADGE_STYLES: Record<string, string> = {
  DRAFT: STATUS_VARIANT.neutral,
  OPEN: STATUS_VARIANT.success,
  CLOSED: STATUS_VARIANT.warning,
  CANCELLED: STATUS_VARIANT.error,
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
    } catch (err) {
      toast({ title: t('postingListLoadFailed'), description: err instanceof Error ? err.message : t('cannotLoadData'), variant: 'destructive' })
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
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/5 rounded-lg flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-[-0.02em]">
              {t('postings')}
            </h1>
            <p className="text-sm text-muted-foreground">{t('totalCount', { count: total })}</p>
          </div>
        </div>
        <button
          onClick={() => router.push('/recruitment/new')}
          className={`inline-flex items-center gap-2 ${BUTTON_SIZES.md} ${BUTTON_VARIANTS.primary}`}
        >
          <Plus className="w-4 h-4" />
          {t('registerPosting')}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-xl p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={t('searchByTitle')}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-border rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
              className="px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 bg-card"
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
      <div className={TABLE_STYLES.wrapper}>
        <table className={TABLE_STYLES.table}>
          <thead>
            <tr className={TABLE_STYLES.header}>
              <th className={TABLE_STYLES.headerCell}>{t('postingTitleCol')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('department')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('jobGrade')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('employmentType')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('headcountColumn')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('applicantCountCol')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('statusCol')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('registeredDate')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-border border-t-primary rounded-full animate-spin" />
                    {t('loadingData')}
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  {t('noPostings')}
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => router.push(`/recruitment/${row.id}`)}
                  className={TABLE_STYLES.rowClickable}
                >
                  <td className="px-4 py-3 text-sm text-foreground font-medium">
                    {row.title}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {row.department?.name ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {row.jobGrade?.name ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {EMPLOYMENT_TYPE_KEYS[row.employmentType] ? t(EMPLOYMENT_TYPE_KEYS[row.employmentType]) : row.employmentType}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground text-center">
                    {row.headcount}
                  </td>
                  <td className="px-4 py-3 text-sm text-blue-500 font-medium text-center">
                    {row._count.applications}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${STATUS_BADGE_STYLES[row.status] ?? STATUS_VARIANT.neutral}`}>
                      {STATUS_KEYS[row.status] ? t(STATUS_KEYS[row.status]) : row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {format(new Date(row.createdAt), 'yyyy-MM-dd')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground">
              {t('paginationInfo', { total, from: (page - 1) * LIMIT + 1, to: Math.min(page * LIMIT, total) })}
            </p>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-border hover:bg-background disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-muted-foreground" />
              </button>
              <span className="px-3 text-sm text-foreground">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-border hover:bg-background disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
