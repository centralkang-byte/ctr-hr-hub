'use client'

import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/hooks/use-toast'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 지원자 관리 목록 (Client)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
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
import { BUTTON_SIZES, BUTTON_VARIANTS,  TABLE_STYLES } from '@/lib/styles'

// ─── Constants ──────────────────────────────────────────

const STAGE_KEYS: Record<string, string> = {
  APPLIED: 'stageAPPLIED',
  SCREENING: 'stageSCREENING',
  INTERVIEW_1: 'stageINTERVIEW_1',
  INTERVIEW_2: 'stageINTERVIEW_2',
  FINAL: 'stageFINAL',
  OFFER: 'stageOFFER',
  HIRED: 'stageHIRED',
  REJECTED: 'stageREJECTED',
}

const STAGE_BADGE_STYLES: Record<string, string> = {
  APPLIED: 'bg-muted text-muted-foreground',
  SCREENING: 'bg-primary/5 text-blue-800',
  INTERVIEW_1: 'bg-primary/5 text-blue-800',
  INTERVIEW_2: 'bg-primary/5 text-blue-800',
  FINAL: 'bg-orange-500/10 text-orange-800',
  OFFER: 'bg-primary/10 text-tertiary',
  HIRED: 'bg-primary/10 text-green-900 font-bold',
  REJECTED: 'bg-destructive/5 text-destructive',
}

const SOURCE_KEYS: Record<string, string> = {
  DIRECT: 'sourceDIRECT',
  REFERRAL: 'sourceREFERRAL',
  AGENCY: 'sourceAGENCY',
  JOB_BOARD: 'sourceJOB_BOARD',
  INTERNAL: 'sourceINTERNAL',
}

const SOURCE_BADGE_STYLES: Record<string, string> = {
  DIRECT: 'bg-muted text-muted-foreground',
  REFERRAL: 'bg-primary/10 text-tertiary',
  AGENCY: 'bg-primary/5 text-blue-800',
  JOB_BOARD: 'bg-orange-500/10 text-orange-800',
  INTERNAL: 'bg-purple-500/10 text-purple-800',
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

export default function ApplicantListClient({
 user, postingId }: Props) {
  const t = useTranslations('recruitment')
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
    } catch (err) {
      toast({ title: t('applicantListLoadFailed'), description: err instanceof Error ? err.message : t('cannotLoadData'), variant: 'destructive' })
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
      return <span className="text-sm text-muted-foreground">-</span>
    }
    let colorClass = 'text-red-500'
    if (score >= 80) colorClass = 'text-primary'
    else if (score >= 50) colorClass = 'text-orange-500'
    return <span className={`text-sm font-medium ${colorClass}`}>{t('scorePoints', { score })}</span>
  }

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/recruitment/${postingId}`)}
            className="p-2 rounded-lg border border-border hover:bg-card transition-colors duration-150"
          >
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/5 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h1
                className="text-xl font-bold text-foreground"
                style={{ letterSpacing: '-0.02em' }}
              >
                {t('applicantManagement')}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t('totalCountPeople', { count: total })}
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={() => router.push(`/recruitment/${postingId}/applicants/new`)}
          className={`inline-flex items-center gap-2 ${BUTTON_SIZES.md} ${BUTTON_VARIANTS.primary}`}
        >
          <Plus className="w-4 h-4" />
          {t('registerApplicant')}
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-card border border-border rounded-xl p-4 mb-6">
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={t('searchApplicantPlaceholder')}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full pl-10 pr-4 py-2 text-sm border border-border rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors duration-150"
            />
          </div>
          {/* Stage Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={stageFilter}
              onChange={(e) => {
                setStageFilter(e.target.value)
                setPage(1)
              }}
              className="px-3 py-2 text-sm border border-border rounded-lg bg-card focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors duration-150"
            >
              <option value="">{t('allStages')}</option>
              {STAGES_ALL.map((s) => (
                <option key={s} value={s}>
                  {STAGE_KEYS[s] ? t(STAGE_KEYS[s]) : s}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleSearch}
            className="px-4 py-2 text-sm font-medium bg-foreground text-white rounded-lg hover:bg-[#333] transition-colors duration-150"
          >
            {t('searchButton')}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className={TABLE_STYLES.wrapper}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-4 h-4 border-2 border-border border-t-primary rounded-full animate-spin" />
              {t('loadingData')}
            </div>
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Users className="w-8 h-8 mb-2" />
            <p className="text-sm">{t('noApplicants')}</p>
          </div>
        ) : (
          <>
            <table className={TABLE_STYLES.table}>
              <thead>
                <tr className={TABLE_STYLES.header}>
                  <th className={TABLE_STYLES.headerCell}>
                    {t('nameColumn')}
                  </th>
                  <th className={TABLE_STYLES.headerCell}>
                    {t('emailColumn')}
                  </th>
                  <th className={TABLE_STYLES.headerCell}>
                    {t('sourceColumn')}
                  </th>
                  <th className={TABLE_STYLES.headerCell}>
                    {t('aiScoreColumn')}
                  </th>
                  <th className={TABLE_STYLES.headerCell}>
                    {t('stageColumn')}
                  </th>
                  <th className={TABLE_STYLES.headerCell}>
                    {t('appliedDateColumn')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {!data?.length && <EmptyState />}
              {data?.map((app) => (
                  <tr
                    key={app.id}
                    onClick={() => router.push(`/recruitment/${postingId}/applicants/${app.id}`)}
                    className={TABLE_STYLES.rowClickable}
                  >
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-foreground">
                        {app.applicant.name}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-muted-foreground">
                        {app.applicant.email}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                          SOURCE_BADGE_STYLES[app.applicant.source] ?? 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {SOURCE_KEYS[app.applicant.source] ? t(SOURCE_KEYS[app.applicant.source]) : app.applicant.source}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {getAiScoreDisplay(app.aiScreeningScore)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                          STAGE_BADGE_STYLES[app.stage] ?? 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {STAGE_KEYS[app.stage] ? t(STAGE_KEYS[app.stage]) : app.stage}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(app.appliedAt), 'yyyy-MM-dd')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  {t('paginationInfo', { total, from: (page - 1) * LIMIT + 1, to: Math.min(page * LIMIT, total) })}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="p-2 rounded-lg border border-border hover:bg-background disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
                  >
                    <ChevronLeft className="w-4 h-4 text-muted-foreground" />
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
                            ? 'bg-foreground text-white'
                            : 'text-muted-foreground hover:bg-background'
                        }`}
                      >
                        {pg}
                      </button>
                    )
                  })}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="p-2 rounded-lg border border-border hover:bg-background disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
                  >
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
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
