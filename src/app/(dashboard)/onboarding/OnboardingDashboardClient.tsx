'use client'

import { TableSkeleton } from '@/components/ui/LoadingSkeleton'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Onboarding Dashboard Client
// B5 강화: 법인 필터, planType 탭, 감정 펄스, 지연 하이라이트
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { AlertTriangle, CheckCircle2, Clock, Frown, Lock, Meh, Smile } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { apiClient } from '@/lib/api'
import { ROLE } from '@/lib/constants'
import type { SessionUser, PaginationInfo } from '@/types'
import { TABLE_STYLES } from '@/lib/styles'
import { STATUS_VARIANT } from '@/lib/styles/status'
import { toast } from '@/hooks/use-toast'

// ─── Types ──────────────────────────────────────────────────

interface OnboardingTask {
  id: string
  status: string
  task: { isRequired: boolean; dueDaysAfter: number }
}

interface EmotionPulse {
  mood: 'GREAT' | 'GOOD' | 'NEUTRAL' | 'STRUGGLING' | 'BAD'
  energy: number
  belonging: number
  submittedAt: string
}

interface OnboardingRow {
  id: string
  status: string
  planType: string
  startedAt: string | null
  employee: { id: string; name: string; hireDate: string | null }
  buddy: { id: string; name: string } | null
  template: { id: string; name: string; planType: string }
  tasks: OnboardingTask[]
  progress: { total: number; completed: number }
  isDelayed: boolean
  emotionPulse: EmotionPulse | null
}

interface Company {
  id: string
  code: string
  name: string
}

interface OnboardingDashboardClientProps {
  user: SessionUser
  companies?: Company[]
}

// ─── Constants ──────────────────────────────────────────────

const STATUS_BADGE_STYLES: Record<string, string> = {
  IN_PROGRESS: STATUS_VARIANT.info,
  COMPLETED: STATUS_VARIANT.success,
}

const MOOD_CONFIG: Record<string, { icon: typeof Smile; color: string; label: string }> = {
  GREAT: { icon: Smile, color: 'text-[#22C55E]', label: '매우 좋음' },
  GOOD: { icon: Smile, color: 'text-[#16A34A]', label: '좋음' },
  NEUTRAL: { icon: Meh, color: 'text-[#F59E0B]', label: '보통' },
  STRUGGLING: { icon: Frown, color: 'text-[#EF4444]', label: '힘듦' },
  BAD: { icon: Frown, color: 'text-[#DC2626]', label: '나쁨' },
}

const PLAN_TYPE_TABS = [
  { value: '', label: '전체' },
  { value: 'ONBOARDING', label: '온보딩' },
  { value: 'OFFBOARDING', label: '오프보딩' },
  { value: 'CROSSBOARDING_DEPARTURE', label: '크로스보딩 출발' },
  { value: 'CROSSBOARDING_ARRIVAL', label: '크로스보딩 도착' },
]

const LIMIT_OPTIONS = [10, 20, 50]

// ─── Component ──────────────────────────────────────────────

export function OnboardingDashboardClient({ user, companies = [] }: OnboardingDashboardClientProps) {
  const t = useTranslations('onboarding')
  const tCommon = useTranslations('common')
  const router = useRouter()

  // ─── State ───
  const [filter, setFilter] = useState('__ALL__')
  const [planType, setPlanType] = useState('')
  const [companyIdFilter, setCompanyIdFilter] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [data, setData] = useState<OnboardingRow[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [loading, setLoading] = useState(true)

  // Force-complete dialog state
  const [forceTarget, setForceTarget] = useState<OnboardingRow | null>(null)
  const [forceReason, setForceReason] = useState('')
  const [forceLoading, setForceLoading] = useState(false)

  const isHrAdmin = user.role === ROLE.HR_ADMIN || user.role === ROLE.SUPER_ADMIN
  const isSuperAdmin = user.role === ROLE.SUPER_ADMIN

  const STATUS_LABELS: Record<string, string> = {
    IN_PROGRESS: t('inProgress'),
    COMPLETED: t('completed'),
  }

  const FILTER_OPTIONS = [
    { value: '__ALL__', label: t('filterAll') },
    { value: 'IN_PROGRESS', label: t('filterInProgress') },
    { value: 'COMPLETED', label: t('filterCompleted') },
    { value: 'DELAYED', label: t('filterDelayed') },
  ]

  // ─── Fetch ───
  const fetchData = useCallback(() => {
    setLoading(true)
    const params: Record<string, string | number> = { page, limit }
    if (filter !== '__ALL__' && filter !== 'DELAYED') {
      params.status = filter
    }
    // DELAYED: fetch IN_PROGRESS and filter client-side
    if (filter === 'DELAYED') {
      params.status = 'IN_PROGRESS'
    }
    if (planType) params.planType = planType
    if (companyIdFilter) params.companyId = companyIdFilter

    apiClient
      .getList<OnboardingRow>('/api/v1/onboarding/dashboard', params)
      .then((res) => {
        let rows = res.data
        if (filter === 'DELAYED') {
          rows = rows.filter((r) => r.isDelayed)
        }
        setData(rows)
        setPagination(res.pagination)
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [page, limit, filter, planType, companyIdFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ─── Force complete handler ───
  const handleForceComplete = useCallback(async () => {
    if (!forceTarget || !forceReason.trim()) return
    setForceLoading(true)
    try {
      await apiClient.put(`/api/v1/onboarding/${forceTarget.id}/force-complete`, {
        reason: forceReason.trim(),
      })
      setForceTarget(null)
      setForceReason('')
      fetchData()
    } catch {
      // Error handled by apiClient
    } finally {
      setForceLoading(false)
    }
  }, [forceTarget, forceReason, fetchData])

  // ─── Pagination ───
  const totalPages = pagination?.totalPages ?? 1

  // ─── Progress bar renderer ───
  const ProgressBar = useMemo(
    () =>
      function ProgressBarInner({
        completed,
        total,
      }: {
        completed: number
        total: number
      }) {
        const pct = total > 0 ? (completed / total) * 100 : 0
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-[#F0F0F3] rounded-full h-2">
              <div
                className="bg-[#5E81F4] h-2 rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-sm text-[#8181A5] whitespace-nowrap">
              {completed}/{total}
            </span>
          </div>
        )
      },
    [],
  )

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title={t('dashboardTitle')}
        description={t('dashboardDescription')}
      />

      {/* ─── Plan Type Tabs ─── */}
      <div className="flex border-b border-[#F0F0F3]">
        {PLAN_TYPE_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setPlanType(tab.value)
              setPage(1)
            }}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${planType === tab.value
                ? 'border-b-2 border-[#5E81F4] text-[#5E81F4]'
                : 'text-[#8181A5] hover:text-[#1C1D21]'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── Filters ─── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setFilter(opt.value)
                setPage(1)
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${filter === opt.value
                  ? 'bg-[#5E81F4] text-white border-[#5E81F4]'
                  : 'bg-white text-[#8181A5] border-[#F0F0F3] hover:border-[#5E81F4]'
                }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* SUPER_ADMIN only: company filter */}
        {isSuperAdmin && companies.length > 0 && (
          <select
            value={companyIdFilter}
            onChange={(e) => {
              setCompanyIdFilter(e.target.value)
              setPage(1)
            }}
            className="text-sm border border-[#F0F0F3] rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#5E81F4] focus:ring-2 focus:ring-[#5E81F4]/10"
          >
            <option value="">전체 법인</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
        )}

        <select
          value={String(limit)}
          onChange={(e) => {
            setLimit(Number(e.target.value))
            setPage(1)
          }}
          className="text-sm border border-[#F0F0F3] rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#5E81F4] focus:ring-2 focus:ring-[#5E81F4]/10"
        >
          {LIMIT_OPTIONS.map((n) => (
            <option key={n} value={String(n)}>
              {t('itemsPerPage', { n })}
            </option>
          ))}
        </select>
      </div>

      {/* ─── Table ─── */}
      {loading ? (
        <div className={TABLE_STYLES.wrapper}>
          <table className={TABLE_STYLES.table}>
            <thead>
              <tr className={TABLE_STYLES.header}>
                {[t('employeeName'), t('hireDate'), t('buddy'), t('templateLabel'), t('progress'), t('statusLabel'), t('delayed'), '감정', ''].map(
                  (h) => (
                    <th key={h} className={TABLE_STYLES.headerCell + " whitespace-nowrap"}>{h}</th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={`sk-${i}`} className={TABLE_STYLES.row}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={`sk-${i}-${j}`} className={TABLE_STYLES.cell}>
                      <TableSkeleton />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : data.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#F0F0F3] p-8">
          <EmptyState
            title={t('noOnboardingData')}
            description={t('noOnboardingDataDesc')}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className={TABLE_STYLES.wrapper}>
            <table className={TABLE_STYLES.table}>
              <thead>
                <tr className={TABLE_STYLES.header}>
                  <th className={TABLE_STYLES.headerCell + " whitespace-nowrap"}>{t('employeeName')}</th>
                  <th className={TABLE_STYLES.headerCell + " whitespace-nowrap"}>{t('hireDate')}</th>
                  <th className={TABLE_STYLES.headerCell + " whitespace-nowrap"}>{t('buddy')}</th>
                  <th className={TABLE_STYLES.headerCell + " whitespace-nowrap"}>{t('templateLabel')}</th>
                  <th className={TABLE_STYLES.headerCell + " whitespace-nowrap w-48"}>{t('progress')}</th>
                  <th className={TABLE_STYLES.headerCell + " whitespace-nowrap"}>{t('statusLabel')}</th>
                  <th className={TABLE_STYLES.headerCell + " whitespace-nowrap"}>{t('delayed')}</th>
                  <th className={TABLE_STYLES.headerCell + " whitespace-nowrap"}>감정</th>
                  {isHrAdmin && <th className={TABLE_STYLES.headerCell + " whitespace-nowrap w-24"} />}
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr
                    key={row.id}
                    className={`${TABLE_STYLES.rowClickable} ${row.isDelayed ? 'bg-[#FEF2F2]/30' : ''}`}
                    onClick={() => router.push(`/onboarding/${row.id}`)}
                  >
                    <td className={TABLE_STYLES.cell}>
                      {row.employee.name}
                    </td>
                    <td className={TABLE_STYLES.cellMuted}>
                      {row.employee.hireDate
                        ? new Date(row.employee.hireDate).toLocaleDateString(
                          'ko-KR',
                        )
                        : '-'}
                    </td>
                    <td className={TABLE_STYLES.cellMuted}>{row.buddy?.name ?? '-'}</td>
                    <td className={TABLE_STYLES.cellMuted}>{row.template.name}</td>
                    <td className={TABLE_STYLES.cell}>
                      <ProgressBar
                        completed={row.progress.completed}
                        total={row.progress.total}
                      />
                    </td>
                    <td className={TABLE_STYLES.cell}>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-[4px] text-xs font-semibold ${STATUS_BADGE_STYLES[row.status] ?? STATUS_VARIANT.neutral}`}
                      >
                        {row.status === 'IN_PROGRESS' && (
                          <Clock className="mr-1 h-3 w-3" />
                        )}
                        {row.status === 'COMPLETED' && (
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                        )}
                        {STATUS_LABELS[row.status] ?? row.status}
                      </span>
                    </td>
                    <td className={TABLE_STYLES.cell}>
                      {row.isDelayed ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-[4px] text-xs font-semibold bg-[#FEF2F2] text-[#EF4444]">
                          <AlertTriangle className="mr-1 h-3 w-3" />
                          {t('delayed')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-[4px] text-xs font-semibold bg-[#DCFCE7] text-[#16A34A]">
                          {t('normal')}
                        </span>
                      )}
                    </td>
                    <td className={TABLE_STYLES.cell}>
                      {row.emotionPulse ? (() => {
                        const cfg = MOOD_CONFIG[row.emotionPulse.mood]
                        if (!cfg) return <span className="text-xs text-[#8181A5]">-</span>
                        const Icon = cfg.icon
                        return (
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-medium ${cfg.color}`}
                            title={cfg.label}
                          >
                            <Icon className="h-4 w-4" />
                            {cfg.label}
                          </span>
                        )
                      })() : (
                        <span className="text-xs text-[#8181A5]">-</span>
                      )}
                    </td>
                    {isHrAdmin && (
                      <td className={TABLE_STYLES.cell}>
                        {row.status !== 'COMPLETED' && (
                          <button
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#F0F0F3] text-[#8181A5] hover:bg-[#F5F5FA] transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              setForceTarget(row);
                            }}
                          >
                            {t('forceComplete')}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ─── Pagination ─── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-2">
              <p className="text-sm text-[#8181A5]">
                {t('totalItems', { total: pagination?.total.toLocaleString() ?? '0' })}
              </p>
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-1.5 text-sm font-medium rounded-lg border border-[#F0F0F3] text-[#8181A5] hover:bg-[#F5F5FA] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  {tCommon('prev')}
                </button>
                <span className="text-sm text-[#8181A5]">
                  {page} / {totalPages}
                </span>
                <button
                  className="px-3 py-1.5 text-sm font-medium rounded-lg border border-[#F0F0F3] text-[#8181A5] hover:bg-[#F5F5FA] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {tCommon('next')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Force Complete Dialog ─── */}
      <Dialog
        open={!!forceTarget}
        onOpenChange={(open) => {
          if (!open) {
            setForceTarget(null)
            setForceReason('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('forceCompleteTitle')}</DialogTitle>
            <DialogDescription>
              {t('forceCompleteDesc', { name: forceTarget?.employee.name ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label
              htmlFor="force-reason"
              className="text-sm font-medium mb-2 block"
            >
              {t('forceCompleteReason')}
            </label>
            <Textarea
              id="force-reason"
              placeholder={t('forceCompleteReasonPlaceholder')}
              value={forceReason}
              onChange={(e) => setForceReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <button
              className="px-4 py-2 text-sm font-medium rounded-lg border border-[#F0F0F3] text-[#8181A5] hover:bg-[#F5F5FA] transition-colors"
              onClick={() => {
                setForceTarget(null)
                setForceReason('')
              }}
            >
              {tCommon('cancel')}
            </button>
            <button
              onClick={handleForceComplete}
              disabled={!forceReason.trim() || forceLoading}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#EF4444] hover:bg-[#DC2626] text-white disabled:opacity-50 transition-colors"
            >
              {forceLoading ? t('processing') : t('forceCompleteConfirm')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
