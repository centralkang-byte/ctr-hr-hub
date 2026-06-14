'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 채용 (Client)
// 프로토 page-jobs.jsx 정합: KPI 스트립 + 3탭(공고 명세/파이프라인/후보군) + 공고 카드 그리드
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  Search, Plus, ChevronLeft, ChevronRight, Briefcase, Filter,
  Users, Inbox, CheckCircle2, GitBranch, UserSearch,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import { ROLE } from '@/lib/constants'
import { BUTTON_SIZES, BUTTON_VARIANTS } from '@/lib/styles'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { WdStatStrip } from '@/components/shared/WdStatStrip'
import { EmptyState } from '@/components/shared/EmptyState'
import RecruitmentJobCard from './RecruitmentJobCard'

// ─── Label Maps ──────────────────────────────────────────

const STATUS_KEYS: Record<string, string> = {
  DRAFT: 'statusDRAFT',
  OPEN: 'statusOPEN',
  CLOSED: 'statusCLOSED',
  CANCELLED: 'statusCANCELLED',
}

const EMPLOYMENT_TYPE_KEYS: Record<string, string> = {
  FULL_TIME: 'typeFULL_TIME',
  CONTRACT: 'typeCONTRACT',
  DISPATCH: 'typeDISPATCH',
  INTERN: 'typeINTERN',
}

// ─── Types ───────────────────────────────────────────────

interface PostingFunnel {
  applied: number
  screen: number
  interview: number
  offer: number
}

interface PostingRecord {
  id: string
  title: string
  status: string
  employmentType: string
  headcount: number
  createdAt: string
  location: string | null
  deadlineDate: string | null
  department: { id: string; name: string } | null
  jobGrade: { id: string; name: string } | null
  creator: { id: string; name: string } | null
  _count: { applications: number }
  funnel: PostingFunnel
}

interface RecruitmentSummary {
  activePostings: number
  totalApplicants: number
  inInterview: number
  offersOut: number
}

interface Props {
  user: SessionUser
}

const LIMIT = 20

// ─── Component ───────────────────────────────────────────

export default function RecruitmentListClient({ user }: Props) {
  const router = useRouter()
  const t = useTranslations('recruitment')
  const [tab, setTab] = useState('jobs')
  const [data, setData] = useState<PostingRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [summary, setSummary] = useState<RecruitmentSummary | null>(null)

  const canCreate = user.role === ROLE.SUPER_ADMIN || user.role === ROLE.HR_ADMIN

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
  }, [page, search, statusFilter, t])

  useEffect(() => { fetchData() }, [fetchData])

  // KPI 요약 — 회사 범위(OPEN 기준), 페이지/필터 무관하게 1회.
  useEffect(() => {
    let active = true
    apiClient
      .get<RecruitmentSummary>('/api/v1/recruitment/postings/summary')
      .then((res) => { if (active) setSummary(res.data) })
      .catch((err) => {
        if (active) {
          toast({ title: t('summaryLoadFailed'), description: err instanceof Error ? err.message : t('cannotLoadData'), variant: 'destructive' })
        }
      })
    return () => { active = false }
  }, [t])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  const totalPages = Math.ceil(total / LIMIT)

  const kpiItems = [
    { label: t('kpiActivePostings'), value: summary?.activePostings ?? '—', icon: Briefcase, tone: 'default' as const },
    { label: t('kpiTotalApplicants'), value: summary?.totalApplicants ?? '—', icon: Users, tone: 'info' as const },
    { label: t('kpiInInterview'), value: summary?.inInterview ?? '—', icon: Inbox, tone: 'warning' as const },
    { label: t('kpiOffersOut'), value: summary?.offersOut ?? '—', icon: CheckCircle2, tone: 'success' as const },
  ]

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/5">
            <Briefcase className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-[-0.02em] text-foreground">{t('postings')}</h1>
            <p className="text-sm text-muted-foreground">{t('totalCount', { count: total })}</p>
          </div>
        </div>
        {canCreate && (
          <button
            onClick={() => router.push('/recruitment/new')}
            className={`inline-flex items-center gap-2 ${BUTTON_SIZES.md} ${BUTTON_VARIANTS.primary}`}
          >
            <Plus className="h-4 w-4" />
            {t('registerPosting')}
          </button>
        )}
      </div>

      {/* KPI strip (Pattern A) — 진행 중(OPEN) 공고 기준 */}
      <WdStatStrip items={kpiItems} className="mb-2" />
      <p className="mb-6 text-xs text-muted-foreground">{t('kpiScopeCaption')}</p>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList aria-label={t('tabsAriaLabel')} className="mb-4">
          <TabsTrigger value="jobs">
            <Briefcase className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
            {t('tabJobs')}
            <span className="ml-1.5 rounded-full bg-muted px-1.5 text-[11px] font-medium tabular-nums">{total}</span>
          </TabsTrigger>
          <TabsTrigger value="pipeline">
            <GitBranch className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
            {t('tabPipeline')}
          </TabsTrigger>
          <TabsTrigger value="candidates">
            <UserSearch className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
            {t('tabCandidates')}
          </TabsTrigger>
        </TabsList>

        {/* ── 공고 명세 ── */}
        <TabsContent value="jobs">
          {/* Filters */}
          <div className="mb-6 rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[240px] flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder={t('searchByTitle')}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full rounded-lg border border-border py-2 pl-10 pr-4 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
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

          {/* Card grid (3-state) */}
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary" />
              {t('loadingData')}
            </div>
          ) : data.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card">
              <EmptyState icon={<Briefcase className="h-12 w-12" />} title={t('noPostings')} />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.map((row) => (
                <RecruitmentJobCard
                  key={row.id}
                  posting={row}
                  employmentTypeLabel={EMPLOYMENT_TYPE_KEYS[row.employmentType] ? t(EMPLOYMENT_TYPE_KEYS[row.employmentType]) : row.employmentType}
                  statusLabel={STATUS_KEYS[row.status] ? t(STATUS_KEYS[row.status]) : row.status}
                  onOpen={(id) => router.push(`/recruitment/${id}`)}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {t('paginationInfo', { total, from: (page - 1) * LIMIT + 1, to: Math.min(page * LIMIT, total) })}
              </p>
              <div className="flex items-center gap-1">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label={t('prevPage')}
                  className="rounded-lg border border-border p-1.5 transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                </button>
                <span className="px-3 text-sm text-foreground">{page} / {totalPages}</span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  aria-label={t('nextPage')}
                  className="rounded-lg border border-border p-1.5 transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── 파이프라인 (준비 중) ── */}
        <TabsContent value="pipeline">
          <div className="rounded-2xl border border-border bg-card">
            <EmptyState
              icon={<GitBranch className="h-12 w-12" />}
              title={t('pipelineComingSoon')}
              description={t('pipelineComingSoonSub')}
            />
          </div>
        </TabsContent>

        {/* ── 후보군 (준비 중) ── */}
        <TabsContent value="candidates">
          <div className="rounded-2xl border border-border bg-card">
            <EmptyState
              icon={<UserSearch className="h-12 w-12" />}
              title={t('candidatesComingSoon')}
              description={t('candidatesComingSoonSub')}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
