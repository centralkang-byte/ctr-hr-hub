'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Onboarding Dashboard Client
// 온보딩 현황: 진행률, 지연 여부, 강제 완료
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
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

// ─── Types ──────────────────────────────────────────────────

interface OnboardingTask {
  id: string
  status: string
  task: { isRequired: boolean; dueDaysAfter: number }
}

interface OnboardingRow {
  id: string
  status: string
  startedAt: string | null
  employee: { id: string; name: string; hireDate: string | null; companyId: string }
  buddy: { id: string; name: string } | null
  template: { id: string; name: string }
  tasks: OnboardingTask[]
  progress: { total: number; completed: number }
  isDelayed: boolean
}

interface OnboardingDashboardClientProps {
  user: SessionUser
}

// ─── Constants ──────────────────────────────────────────────

const STATUS_BADGE_STYLES: Record<string, string> = {
  IN_PROGRESS: 'bg-[#FFF3E0] text-[#FF9800]',
  COMPLETED: 'bg-[#E8F5E9] text-[#2E7D32]',
}

const LIMIT_OPTIONS = [10, 20, 50]

// ─── Component ──────────────────────────────────────────────

export function OnboardingDashboardClient({ user }: OnboardingDashboardClientProps) {
  const t = useTranslations('onboarding')
  const tCommon = useTranslations('common')

  // ─── State ───
  const [filter, setFilter] = useState('__ALL__')
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
  }, [page, limit, filter])

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
            <div className="flex-1 bg-[#F5F5F5] rounded-full h-2">
              <div
                className="bg-[#00C853] h-2 rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-sm text-[#666] whitespace-nowrap">
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
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                filter === opt.value
                  ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
                  : 'bg-white text-[#666] border-[#E0E0E0] hover:border-[#999]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <select
          value={String(limit)}
          onChange={(e) => {
            setLimit(Number(e.target.value))
            setPage(1)
          }}
          className="text-sm border border-[#E0E0E0] rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#00C853] focus:ring-2 focus:ring-[#00C853]/10"
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
        <div className="bg-white rounded-xl border border-[#E8E8E8]">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E8E8E8]">
                  {[t('employeeName'), t('hireDate'), t('buddy'), t('templateLabel'), t('progress'), t('statusLabel'), t('delayed'), ''].map(
                    (h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#999]">{h}</th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`sk-${i}`} className="border-b border-[#F0F0F0]">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={`sk-${i}-${j}`} className="px-4 py-3">
                        <div className="h-5 bg-[#F5F5F5] rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : data.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E8E8E8] p-8">
          <EmptyState
            title={t('noOnboardingData')}
            description={t('noOnboardingDataDesc')}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-[#E8E8E8]">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#E8E8E8]">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">{t('employeeName')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">{t('hireDate')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">{t('buddy')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">{t('templateLabel')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#999] w-48">{t('progress')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">{t('statusLabel')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">{t('delayed')}</th>
                    {isHrAdmin && <th className="px-4 py-3 text-left text-xs font-semibold text-[#999] w-24" />}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row) => (
                    <tr
                      key={row.id}
                      className={`border-b border-[#F0F0F0] hover:bg-[#FAFAFA] transition-colors ${row.isDelayed ? 'bg-[#FFF3E0]/30' : ''}`}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-[#1A1A1A]">
                        {row.employee.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#666]">
                        {row.employee.hireDate
                          ? new Date(row.employee.hireDate).toLocaleDateString(
                              'ko-KR',
                            )
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#666]">{row.buddy?.name ?? '-'}</td>
                      <td className="px-4 py-3 text-sm text-[#666]">{row.template.name}</td>
                      <td className="px-4 py-3">
                        <ProgressBar
                          completed={row.progress.completed}
                          total={row.progress.total}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-[4px] text-xs font-semibold ${STATUS_BADGE_STYLES[row.status] ?? 'bg-[#F5F5F5] text-[#666]'}`}
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
                      <td className="px-4 py-3">
                        {row.isDelayed ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-[4px] text-xs font-semibold bg-[#FFEBEE] text-[#F44336]">
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            {t('delayed')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-[4px] text-xs font-semibold bg-[#E8F5E9] text-[#2E7D32]">
                            {t('normal')}
                          </span>
                        )}
                      </td>
                      {isHrAdmin && (
                        <td className="px-4 py-3">
                          {row.status !== 'COMPLETED' && (
                            <button
                              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#E0E0E0] text-[#666] hover:bg-[#F5F5F5] transition-colors"
                              onClick={() => setForceTarget(row)}
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
          </div>

          {/* ─── Pagination ─── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-2">
              <p className="text-sm text-[#999]">
                {t('totalItems', { total: pagination?.total.toLocaleString() ?? '0' })}
              </p>
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-1.5 text-sm font-medium rounded-lg border border-[#E0E0E0] text-[#666] hover:bg-[#F5F5F5] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  {tCommon('prev')}
                </button>
                <span className="text-sm text-[#666]">
                  {page} / {totalPages}
                </span>
                <button
                  className="px-3 py-1.5 text-sm font-medium rounded-lg border border-[#E0E0E0] text-[#666] hover:bg-[#F5F5F5] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
              className="px-4 py-2 text-sm font-medium rounded-lg border border-[#E0E0E0] text-[#666] hover:bg-[#F5F5F5] transition-colors"
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
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#F44336] hover:bg-[#D32F2F] text-white disabled:opacity-50 transition-colors"
            >
              {forceLoading ? t('processing') : t('forceCompleteConfirm')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
