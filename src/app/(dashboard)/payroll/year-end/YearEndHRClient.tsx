'use client'

import { useTranslations, useLocale } from 'next-intl'

import { useState, useCallback, useEffect } from 'react'
import {
  FileText,
  CheckCircle2,
  Download,
  ChevronRight,
  X,
  AlertCircle,
  Users,
  Clock,
  Send,
  Eye,
} from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import { BUTTON_SIZES, BUTTON_VARIANTS, MODAL_STYLES, TABLE_STYLES, TYPOGRAPHY } from '@/lib/styles'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'
import { formatDate } from '@/lib/format/date'

// ─── Types ─────────────────────────────────────────────────

interface SettlementRow {
  id: string
  employeeId: string
  employeeName: string
  employeeNo: string
  department: string
  company: string
  companyId: string
  year: number
  status: string
  totalSalary: string
  finalSettlement: string
  localTaxSettlement: string
  determinedTax: string
  prepaidTax: string
  submittedAt: string | null
  confirmedAt: string | null
  confirmedBy: string | null
  withholdingReceipt: {
    id: string
    issuedAt: string
    pdfPath: string | null
  } | null
  updatedAt: string
}

interface StatusSummary {
  not_started: number
  in_progress: number
  submitted: number
  hr_review: number
  confirmed: number
}

interface YearEndHRClientProps {
  user: SessionUser
  defaultYear: number
}

// ─── Helpers ───────────────────────────────────────────────

const STATUS_LABEL_KEYS: Record<string, string> = {
  not_started: 'yearEndHR.statusNotStarted',
  in_progress: 'yearEndHR.statusInProgress',
  submitted: 'yearEndHR.statusSubmitted',
  hr_review: 'yearEndHR.statusHrReview',
  confirmed: 'yearEndHR.statusConfirmed',
}


function formatKRW(amount: string | number, locale: string): string {
  const num = typeof amount === 'string' ? parseInt(amount, 10) : amount
  if (isNaN(num)) return '₩0'
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(num)
}

// ─── Status Badge ──────────────────────────────────────────

function YearEndStatusBadge({ status }: { status: string }) {
  const t = useTranslations('payroll')
  return (
    <StatusBadge status={status.toUpperCase()}>
      {t(STATUS_LABEL_KEYS[status] ?? 'yearEndHR.statusNotStarted')}
    </StatusBadge>
  )
}

// ─── Detail Modal ──────────────────────────────────────────

function SettlementDetailModal({
  settlement,
  onClose,
  onConfirm,
  onIssueReceipt,
  confirming,
  issuingReceipt,
}: {
  settlement: SettlementRow
  onClose: () => void
  onConfirm: (id: string) => void
  onIssueReceipt: (id: string) => void
  confirming: boolean
  issuingReceipt: boolean
}) {
  const t = useTranslations('payroll')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const finalNum = parseInt(settlement.finalSettlement, 10)
  const isRefund = finalNum >= 0

  return (
    <div className={MODAL_STYLES.container}>
      <div className="bg-card rounded-xl shadow-lg w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {settlement.employeeName} — {t('yearEndHR.title', { year: settlement.year })}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {settlement.department} &middot; {settlement.employeeNo}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={tCommon('close')}
            className={cn(BUTTON_VARIANTS.ghost, 'p-2 rounded-lg')}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Status */}
          <div className="flex items-center gap-3">
            <YearEndStatusBadge status={settlement.status} />
            {settlement.submittedAt && (
              <span className="text-xs text-muted-foreground">
                {t('yearEndHR.submittedDate')} {formatDate(settlement.submittedAt)}
              </span>
            )}
            {settlement.confirmedAt && (
              <span className="text-xs text-[#006b39]">
                {t('yearEndHR.confirmedDate')} {formatDate(settlement.confirmedAt)}
              </span>
            )}
          </div>

          {/* Calculation Breakdown */}
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="bg-background px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t('yearEndHR.taxSummary')}
            </div>
            <div className="divide-y divide-border">
              {[
                { label: t('yearEndHR.totalSalary'), value: settlement.totalSalary },
                { label: t('yearEndHR.taxableIncome'), value: settlement.totalSalary },
                { label: t('yearEndHR.calculatedTax'), value: settlement.determinedTax },
                { label: t('yearEndHR.record'), value: settlement.prepaidTax },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-muted-foreground">{row.label}</span>
                  <span className={cn('text-sm font-medium text-foreground', TYPOGRAPHY.mono)}>
                    {formatKRW(row.value, locale)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Final Settlement — ALL-4 시맨틱 토큰 (success=tertiary 계열·warning=D17 bg/text 분리) */}
          <div
            className={`rounded-xl p-5 text-center border border-border ${
              isRefund ? 'bg-tertiary/10' : 'bg-warning-bright/15'
            }`}
          >
            <p
              className={`text-sm font-semibold mb-1 ${isRefund ? 'text-[#006b39]' : 'text-ctr-warning'}`}
            >
              {isRefund ? t('yearEndHR.refundAmount') : t('yearEndHR.additionalPayment')}
            </p>
            <p
              className={cn('text-3xl font-bold', TYPOGRAPHY.mono, isRefund ? 'text-[#006b39]' : 'text-ctr-warning')}
            >
              {formatKRW(Math.abs(finalNum), locale)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t('yearEndHR.includingLocalTax')} {formatKRW(settlement.localTaxSettlement, locale)}
            </p>
          </div>

          {/* Receipt status */}
          {settlement.withholdingReceipt && (
            <div className="flex items-center gap-2 text-sm text-[#006b39]">
              <CheckCircle2 className="h-4 w-4" />
              <span>
                {t('yearEndHR.withholdingIssued')} ({formatDate(settlement.withholdingReceipt.issuedAt)})
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className={cn(BUTTON_VARIANTS.ghost, BUTTON_SIZES.md, 'inline-flex items-center')}
          >
            {tCommon('close')}
          </button>
          <div className="flex gap-2">
            {settlement.status === 'confirmed' && (
              <button
                type="button"
                onClick={() => onIssueReceipt(settlement.id)}
                disabled={issuingReceipt}
                className={cn(BUTTON_VARIANTS.secondary, BUTTON_SIZES.md, 'inline-flex items-center gap-2 disabled:opacity-50')}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                {issuingReceipt ? t('yearEndHR.issuing') : t('yearEndHR.issueReceipt')}
              </button>
            )}
            {(settlement.status === 'submitted' || settlement.status === 'hr_review') && (
              <button
                type="button"
                onClick={() => onConfirm(settlement.id)}
                disabled={confirming}
                className={cn(BUTTON_VARIANTS.primary, BUTTON_SIZES.md, 'inline-flex items-center gap-2 disabled:opacity-50')}
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                {confirming ? tCommon('processing') : t('yearEndHR.confirm')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────

export default function YearEndHRClient({user, defaultYear }: YearEndHRClientProps) {
  const t = useTranslations('payroll')
  const tCommon = useTranslations('common')
  const locale = useLocale()

  const [year, setYear] = useState(defaultYear)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [settlements, setSettlements] = useState<SettlementRow[]>([])
  const [summary, setSummary] = useState<StatusSummary>({
    not_started: 0,
    in_progress: 0,
    submitted: 0,
    hr_review: 0,
    confirmed: 0,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedSettlement, setSelectedSettlement] = useState<SettlementRow | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [issuingReceipt, setIssuingReceipt] = useState(false)
  const [bulkConfirming, setBulkConfirming] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const { confirm, dialogProps } = useConfirmDialog()

  const fetchSettlements = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params: Record<string, string | number> = { year, limit: 200 }
      if (statusFilter !== 'all') params.status = statusFilter

      const res = await apiClient.get<{
        settlements: SettlementRow[]
        summary: StatusSummary
      }>('/api/v1/year-end/hr/settlements', params)

      setSettlements(res.data.settlements ?? [])
      setSummary(res.data.summary ?? {
        not_started: 0, in_progress: 0, submitted: 0, hr_review: 0, confirmed: 0,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('loadFailed')
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [year, statusFilter, t])

  useEffect(() => {
    void fetchSettlements()
  }, [fetchSettlements])

  const handleConfirm = useCallback(
    async (id: string) => {
      setConfirming(true)
      try {
        await apiClient.post(`/api/v1/year-end/hr/settlements/${id}/confirm`)
        await fetchSettlements()
        setSelectedSettlement(null)
      } catch (err) {
        const msg = err instanceof Error ? err.message : t('confirmed_kecb298eb_kec8ba4ed')
        setError(msg)
      } finally {
        setConfirming(false)
      }
    },
    [fetchSettlements, t],
  )

  const handleIssueReceipt = useCallback(async (id: string) => {
    setIssuingReceipt(true)
    try {
      const response = await fetch(`/api/v1/year-end/hr/settlements/${id}/receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!response.ok) {
        const json = await response.json() as { error?: { message?: string } }
        throw new Error(json.error?.message ?? t('yearEndHR.issueReceiptFailed'))
      }
      // Open the HTML receipt in a new tab for printing
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      URL.revokeObjectURL(url)
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('kr_kec9881ec_kebb09ced_kec8ba4ed')
      setError(msg)
    } finally {
      setIssuingReceipt(false)
    }
  }, [t])

  const handleBulkConfirm = useCallback(async () => {
    const confirmableIds = settlements
      .filter(
        (s) =>
          selectedIds.has(s.id) &&
          (s.status === 'submitted' || s.status === 'hr_review'),
      )
      .map((s) => s.id)

    if (confirmableIds.length === 0) {
      setError(t('yearEndHR.noConfirmableSettlements'))
      return
    }

    setBulkConfirming(true)
    try {
      await apiClient.post('/api/v1/year-end/hr/bulk-confirm', {
        year,
        companyId: user.companyId,
        settlementIds: confirmableIds,
      })
      setSelectedIds(new Set())
      await fetchSettlements()
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('kr_kec9dbcea_ked9995ec_kec8ba4ed')
      setError(msg)
    } finally {
      setBulkConfirming(false)
    }
  }, [settlements, selectedIds, year, user.companyId, fetchSettlements, t])

  const handleBulkConfirmAll = useCallback(async () => {
    const confirmable = settlements.filter(
      (s) => s.status === 'submitted' || s.status === 'hr_review',
    )
    if (confirmable.length === 0) {
      setError(t('yearEndHR.noConfirmableSettlements'))
      return
    }

    confirm({ title: t('yearEndHR.bulkConfirmTitle', { count: confirmable.length }), onConfirm: async () => {
      setBulkConfirming(true)
      try {
        await apiClient.post('/api/v1/year-end/hr/bulk-confirm', {
          year,
          companyId: user.companyId,
          settlementIds: confirmable.map((s) => s.id),
        })
        await fetchSettlements()
      } catch (err) {
        const msg = err instanceof Error ? err.message : t('kr_kec9dbcea_ked9995ec_kec8ba4ed')
        setError(msg)
      } finally {
        setBulkConfirming(false)
      }
    }})
  }, [settlements, year, user.companyId, fetchSettlements, confirm, t])

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filteredSettlements =
    statusFilter === 'all'
      ? settlements
      : settlements.filter((s) => s.status === statusFilter)

  const total =
    summary.not_started +
    summary.in_progress +
    summary.submitted +
    summary.hr_review +
    summary.confirmed

  const completionPct = total > 0 ? Math.round((summary.confirmed / total) * 100) : 0

  const confirmableCount = settlements.filter(
    (s) => s.status === 'submitted' || s.status === 'hr_review',
  ).length

  const YEAR_OPTIONS = [defaultYear, defaultYear - 1, defaultYear - 2]

  const STATUS_TABS = [
    { key: 'all', label: t('all'), count: total },
    { key: 'submitted', label: t('submitted'), count: summary.submitted },
    { key: 'hr_review', label: t('hrReviewing'), count: summary.hr_review },
    { key: 'confirmed', label: t('confirmed'), count: summary.confirmed },
  ]

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4">
      {/* ── Header (proto .page-h: 56px 아이콘 타일 + pageTitle + greet-sub) ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px] bg-accent text-primary">
            <FileText className="h-[26px] w-[26px]" aria-hidden="true" />
          </div>
          <div>
            <h1 className={TYPOGRAPHY.pageTitle}>{t('yearEndHR.pageTitle', { year })}</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">{t('yearEndHR.pageSubtitle')}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Year selector */}
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value, 10))}
            className="px-3 py-2 border border-border-strong bg-card rounded-lg text-sm focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none"
          >
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>
                {t('yearEndHR.yearLabel', { year: y })}
              </option>
            ))}
          </select>

          {/* Bulk confirm button */}
          {confirmableCount > 0 && (
            <button
              type="button"
              onClick={handleBulkConfirmAll}
              disabled={bulkConfirming}
              className={cn(BUTTON_VARIANTS.primary, BUTTON_SIZES.md, 'inline-flex items-center gap-1.5 font-semibold disabled:opacity-50')}
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              {bulkConfirming
                ? t('processing')
                : t('yearEndHR.bulkConfirm', { count: confirmableCount })}
            </button>
          )}
        </div>
      </div>

      {/* Error banner — D17 bg/text 분리 (ALL-4) */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-alert-red/10 border border-alert-red/20 rounded-lg text-sm text-destructive">
          <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label={tCommon('close')}
            className="ml-auto p-1 hover:bg-alert-red/20 rounded"
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Progress Overview Cards — 6카드 유지 (ALL-5: WdStatStrip 미적용), 토큰 정합만 (YE-3) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          // 시맨틱 tone = STATUS_MAP 정합 (in_progress·submitted=info, hr_review=warning, confirmed=success)
          { key: 'not_started', label: t('kr_kebafb8ec'), icon: Users, color: 'text-muted-foreground' },
          { key: 'in_progress', label: t('inProgress'), icon: Clock, color: 'text-primary' },
          { key: 'submitted', label: t('submitted'), icon: Send, color: 'text-primary' },
          { key: 'hr_review', label: t('hrReviewing'), icon: Eye, color: 'text-ctr-warning' },
          { key: 'confirmed', label: t('confirmed'), icon: CheckCircle2, color: 'text-[#006b39]' },
        ].map(({ key, label, icon: Icon, color }) => (
          <div key={key} className="bg-card rounded-2xl shadow-sm border border-border p-4">
            <div className={cn('flex items-center gap-1.5 text-xs font-medium mb-1', color)}>
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{label}</span>
            </div>
            <p className={TYPOGRAPHY.stat}>
              {summary[key as keyof StatusSummary]}
            </p>
          </div>
        ))}

        {/* Progress bar card */}
        <div className="bg-card rounded-2xl shadow-sm border border-border p-4">
          <p className={cn(TYPOGRAPHY.label, 'mb-1')}>{t('all_kec9984eb')}</p>
          <p className={cn(TYPOGRAPHY.stat, 'text-primary')}>{completionPct}%</p>
          <div
            role="progressbar"
            aria-valuenow={completionPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('all_kec9984eb')}
            className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden"
          >
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${completionPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Status filter tabs — 필터형 (YE-1): Radix Tabs + TAB_STYLES, 테이블 단일 렌더 (패널 복제 없음).
          statusFilter는 fetchSettlements 재조회 의존성 — setter 외 흐름 무변경 */}
      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList aria-label={tCommon('filterAllStatuses')}>
          {STATUS_TABS.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key} className="gap-1.5">
              {tab.label}
              {tab.count > 0 && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full tabular-nums ${
                    statusFilter === tab.key
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Table */}
      <div className={TABLE_STYLES.wrapper}>
        <table className={TABLE_STYLES.table}>
          <thead>
            <tr className={TABLE_STYLES.header}>
              <th className={TABLE_STYLES.headerCell}>
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-border text-primary"
                  checked={
                    selectedIds.size > 0 &&
                    filteredSettlements.every((s) => selectedIds.has(s.id))
                  }
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedIds(new Set(filteredSettlements.map((s) => s.id)))
                    } else {
                      setSelectedIds(new Set())
                    }
                  }}
                />
              </th>
              {[t('yearEndHR.colName'), t('yearEndHR.colDepartment'), t('yearEndHR.colTotalSalary'), t('yearEndHR.colRefundOrAdditional'), t('yearEndHR.colStatus'), t('yearEndHR.colSubmittedDate'), ''].map(
                (h) => (
                  <th
                    key={h}
                    className={TABLE_STYLES.headerCell}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              // 로딩 = skeleton (ALL-3: 로딩은 EmptyState 금지)
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={8} className="px-4 py-3">
                    <Skeleton className="h-4 w-full" />
                  </td>
                </tr>
              ))
            ) : filteredSettlements.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <EmptyState icon={FileText} title={t('kr_ked95b4eb_keca1b0ea_yearend_ke')} sub="" />
                </td>
              </tr>
            ) : (
              filteredSettlements.map((s) => {
                const finalNum = parseInt(s.finalSettlement, 10)
                const isRefund = finalNum >= 0
                return (
                  <tr
                    key={s.id}
                    className={cn(TABLE_STYLES.row, "cursor-pointer")}
                    onClick={() => setSelectedSettlement(s)}
                  >
                    <td className={TABLE_STYLES.cell} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-border text-primary"
                        checked={selectedIds.has(s.id)}
                        onChange={() => toggleSelect(s.id)}
                      />
                    </td>
                    <td className={TABLE_STYLES.cell}>
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">
                          {s.employeeName}
                        </span>
                        <span className="text-xs text-muted-foreground">{s.employeeNo}</span>
                      </div>
                    </td>
                    <td className={TABLE_STYLES.cell}>{s.department}</td>
                    <td className={cn(TABLE_STYLES.cell, 'text-foreground font-medium', TYPOGRAPHY.mono)}>
                      {formatKRW(s.totalSalary, locale)}
                    </td>
                    <td className={TABLE_STYLES.cell}>
                      <span
                        className={cn('font-semibold', TYPOGRAPHY.mono, isRefund ? 'text-[#006b39]' : 'text-ctr-warning')}
                      >
                        {isRefund ? '+' : '-'} {formatKRW(Math.abs(finalNum), locale)}
                      </span>
                    </td>
                    <td className={TABLE_STYLES.cell}>
                      <YearEndStatusBadge status={s.status} />
                    </td>
                    <td className={TABLE_STYLES.cell}>
                      {formatDate(s.submittedAt)}
                    </td>
                    <td className={TABLE_STYLES.cell} onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          type="button"
                          onClick={() => setSelectedSettlement(s)}
                          className={cn(BUTTON_VARIANTS.ghost, 'flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg')}
                        >
                          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                          {t('kr_keab280ed')}
                        </button>
                        {(s.status === 'submitted' || s.status === 'hr_review') && (
                          <button
                            type="button"
                            onClick={() => handleConfirm(s.id)}
                            disabled={confirming}
                            className={`inline-flex items-center gap-1 ${BUTTON_SIZES.sm} ${BUTTON_VARIANTS.primary} disabled:opacity-50`}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {t('confirmed')}
                          </button>
                        )}
                        {s.status === 'confirmed' && (
                          <button
                            type="button"
                            onClick={() => handleIssueReceipt(s.id)}
                            disabled={issuingReceipt}
                            className={cn(BUTTON_VARIANTS.secondary, BUTTON_SIZES.sm, 'inline-flex items-center gap-1 disabled:opacity-50')}
                          >
                            <Download className="h-3.5 w-3.5" aria-hidden="true" />
                            {t('kr_kec9881ec')}
                          </button>
                        )}
                        <ChevronRight className="h-3.5 w-3.5 text-border" />
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Bulk action bar — 현행 바 유지 (YE-8: 공유 BulkActionBar 미채택, sticky/토큰 정합만).
          탭 전환 후 선택 유지(숨은 행 포함) = 기존 동작 그대로 보존 */}
      {selectedIds.size > 0 && (
        <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-lg">
          <span className="text-sm text-muted-foreground">
            {t('yearEndHR.selectedCount', { count: selectedIds.size })}
          </span>
          <button
            type="button"
            onClick={handleBulkConfirm}
            disabled={bulkConfirming}
            className={cn(BUTTON_VARIANTS.primary, BUTTON_SIZES.md, 'inline-flex items-center gap-2 disabled:opacity-50')}
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            {bulkConfirming ? tCommon('processing') : t('yearEndHR.confirmSelected')}
          </button>
        </div>
      )}
      {/* Detail Modal */}
      {selectedSettlement && (
        <SettlementDetailModal
          settlement={selectedSettlement}
          onClose={() => setSelectedSettlement(null)}
          onConfirm={handleConfirm}
          onIssueReceipt={handleIssueReceipt}
          confirming={confirming}
          issuingReceipt={issuingReceipt}
        />
      )}
    <ConfirmDialog {...dialogProps} />
    </div>
  )
}
