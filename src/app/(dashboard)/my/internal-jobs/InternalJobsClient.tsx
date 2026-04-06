'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/hooks/use-toast'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 내부 공고 (직원 자기 지원)
// B4: /my/internal-jobs
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import {
  Search, Building2, MapPin, Users, Clock,
  CheckCircle2, ArrowRight, BriefcaseBusiness,
  ChevronDown,
} from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import { BUTTON_VARIANTS } from '@/lib/styles'

interface InternalJob {
  id: string
  title: string
  description: string
  employmentType: string
  headcount: number
  location?: string
  workMode?: string
  deadlineDate?: string
  salaryRangeMin?: number
  salaryRangeMax?: number
  salaryHidden?: boolean
  urgency: string
  targetDate?: string
  company: { id: string; name: string }
  department: { id: string; name: string }
  position?: { id: string; code: string; titleKo: string }
  alreadyApplied: boolean
  myStage?: string
  createdAt: string
}

const EMP_TYPE_KEYS: Record<string, string> = {
  FULL_TIME: 'empType.fullTime',
  CONTRACT: 'empType.contract',
  DISPATCH: 'empType.dispatch',
  INTERN: 'empType.intern',
}

const WORK_MODE_KEYS: Record<string, string> = {
  OFFICE: 'workMode.office',
  REMOTE: 'workMode.remote',
  HYBRID: 'workMode.hybrid',
}

const URGENCY_COLORS: Record<string, string> = {
  urgent: 'bg-destructive/10 text-destructive',
  normal: 'bg-amber-500/15 text-amber-700',
  low: 'bg-sky-500/10 text-sky-700',
}

const STAGE_KEYS: Record<string, string> = {
  APPLIED: 'stage.applied',
  SCREENING: 'stage.screening',
  INTERVIEW_1: 'stage.interview1',
  INTERVIEW_2: 'stage.interview2',
  FINAL: 'stage.final',
  OFFER: 'stage.offer',
  HIRED: 'stage.hired',
  REJECTED: 'stage.rejected',
}

export default function InternalJobsClient({ user: _user }: { user: SessionUser }) {
  const t = useTranslations('internalJobs')
  const tCommon = useTranslations('common')
  const [items, setItems] = useState<InternalJob[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [applying, setApplying] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (search) params.search = search
      if (companyId) params.companyId = companyId
      const res = await apiClient.getList<InternalJob>('/api/v1/recruitment/internal-jobs', params)
      setItems(res.data ?? [])
    } catch (err) {
      toast({ title: t('fetchError'), description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [search, companyId])

  useEffect(() => { load() }, [load])

  const handleApply = async (jobId: string) => {
    if (applying) return
    setApplying(jobId)
    try {
      await apiClient.post(`/api/v1/recruitment/internal-jobs/${jobId}/apply`, {})
      await load()
    } catch (e: unknown) {
      toast({ title: e instanceof Error ? e.message : t('applyError'), variant: 'destructive' })
    } finally {
      setApplying(null)
    }
  }

  // 법인 목록 추출 (중복 제거)
  const companies = Array.from(
    new Map(items.map((i) => [i.company.id, i.company])).values(),
  )

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t('description')}
        </p>
      </div>

      {/* 검색 + 필터 */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10 focus:border-primary"
          />
        </div>
        <select
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg text-sm text-muted-foreground focus:ring-2 focus:ring-primary/10 focus:border-primary"
        >
          <option value="">{t('allCompanies')}</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* 공고 목록 */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">{tCommon('loading')}</div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
          <BriefcaseBusiness size={40} className="mb-3 text-border" />
          <EmptyState />
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((job) => {
            const isExpanded = expandedId === job.id
            const urgencyColor = URGENCY_COLORS[job.urgency] ?? URGENCY_COLORS.normal
            const urgencyLabel = job.urgency === 'urgent' ? t('urgency.urgent') : job.urgency === 'normal' ? t('urgency.normal') : t('urgency.low')

            return (
              <div
                key={job.id}
                className="bg-card rounded-xl border border-border overflow-hidden hover:border-primary/40 transition-colors"
              >
                {/* 카드 상단 */}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* 배지 */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${urgencyColor}`}>
                          {urgencyLabel}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary/90 font-medium">
                          {t('badge.internal')}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {EMP_TYPE_KEYS[job.employmentType] ? t(EMP_TYPE_KEYS[job.employmentType]) : job.employmentType}
                        </span>
                      </div>

                      {/* 제목 */}
                      <h3 className="font-semibold text-foreground text-base">{job.title}</h3>

                      {/* 메타 */}
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Building2 size={13} />
                          {job.company.name}
                        </span>
                        <span>·</span>
                        <span>{job.department.name}</span>
                        {job.location && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-1">
                              <MapPin size={13} />
                              {job.location}
                            </span>
                          </>
                        )}
                        {job.workMode && (
                          <>
                            <span>·</span>
                            <span>{WORK_MODE_KEYS[job.workMode] ? t(WORK_MODE_KEYS[job.workMode]) : job.workMode}</span>
                          </>
                        )}
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Users size={13} />
                          {t('headcount', { count: job.headcount })}
                        </span>
                      </div>

                      {/* 급여 / 마감일 */}
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        {!job.salaryHidden && job.salaryRangeMin && job.salaryRangeMax && (
                          <span>
                            {t('salary', { min: (job.salaryRangeMin / 10000).toFixed(0), max: (job.salaryRangeMax / 10000).toFixed(0) })}
                          </span>
                        )}
                        {job.deadlineDate && (
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {t('deadline', { date: new Date(job.deadlineDate).toLocaleDateString('ko-KR') })}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 지원 버튼 / 상태 */}
                    <div className="flex-shrink-0 flex flex-col items-end gap-2">
                      {job.alreadyApplied ? (
                        <div className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/15 text-emerald-700 rounded-lg text-sm font-medium">
                          <CheckCircle2 size={14} />
                          {STAGE_KEYS[job.myStage ?? ''] ? t(STAGE_KEYS[job.myStage ?? '']) : t('stage.applied')}
                        </div>
                      ) : (
                        <button
                          onClick={() => handleApply(job.id)}
                          disabled={applying === job.id}
                          className={`flex items-center gap-1.5 px-3 py-1.5 ${BUTTON_VARIANTS.primary} rounded-lg text-sm font-medium disabled:opacity-50`}
                        >
                          <ArrowRight size={14} />
                          {applying === job.id ? t('applying') : t('apply')}
                        </button>
                      )}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : job.id)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-muted-foreground"
                      >
                        {t('viewDetails')}
                        <ChevronDown
                          size={13}
                          className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                {/* 공고 상세 (접기/펼치기) */}
                {isExpanded && (
                  <div className="border-t border-border p-5 bg-background">
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {job.description}
                    </p>
                    {job.position && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        {t('position')}: [{job.position.code}] {job.position.titleKo}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
