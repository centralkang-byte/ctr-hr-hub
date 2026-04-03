'use client'

import { useTranslations } from 'next-intl'

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
import { BUTTON_SIZES, BUTTON_VARIANTS, MODAL_STYLES, TABLE_STYLES } from '@/lib/styles'
import { STATUS_VARIANT } from '@/lib/styles/status'
import { cn } from '@/lib/utils'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'

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

const STATUS_LABELS: Record<string, string> = {
  not_started: '미시작',
  in_progress: '진행중',
  submitted: '제출완료',
  hr_review: 'HR검토중',
  confirmed: '확정',
}

const STATUS_COLORS: Record<string, string> = {
  not_started: STATUS_VARIANT.neutral,
  in_progress: STATUS_VARIANT.info,
  submitted: STATUS_VARIANT.warning,
  hr_review: STATUS_VARIANT.primary,
  confirmed: STATUS_VARIANT.success,
}

function formatKRW(amount: string | number): string {
  const num = typeof amount === 'string' ? parseInt(amount, 10) : amount
  if (isNaN(num)) return '₩0'
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(num)
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

// ─── Status Badge ──────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? STATUS_VARIANT.neutral
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${color}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
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
  const finalNum = parseInt(settlement.finalSettlement, 10)
  const isRefund = finalNum >= 0

  return (
    <div className={MODAL_STYLES.container}>
      <div className="bg-card rounded-xl shadow-lg w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {settlement.employeeName} — {settlement.year}년 연말정산
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {settlement.department} &middot; {settlement.employeeNo}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Status */}
          <div className="flex items-center gap-3">
            <StatusBadge status={settlement.status} />
            {settlement.submittedAt && (
              <span className="text-xs text-muted-foreground">
                제출일: {formatDate(settlement.submittedAt)}
              </span>
            )}
            {settlement.confirmedAt && (
              <span className="text-xs text-emerald-600">
                확정일: {formatDate(settlement.confirmedAt)}
              </span>
            )}
          </div>

          {/* Calculation Breakdown */}
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="bg-background px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {'소득세 계산 요약'}
            </div>
            <div className="divide-y divide-border">
              {[
                { label: '① 총급여', value: settlement.totalSalary },
                { label: '⑤ 과세표준', value: settlement.totalSalary },
                { label: '⑦ 산출세액', value: settlement.determinedTax },
                { label: '기록하기', value: settlement.prepaidTax },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-muted-foreground">{row.label}</span>
                  <span className="text-sm font-medium text-foreground">
                    {formatKRW(row.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Final Settlement */}
          <div
            className={`rounded-xl p-5 text-center ${
              isRefund
                ? 'bg-emerald-500/15 border border-emerald-200'
                : 'bg-amber-500/15 border border-amber-300'
            }`}
          >
            <p
              className={`text-sm font-semibold mb-1 ${isRefund ? 'text-emerald-700' : 'text-amber-700'}`}
            >
              {isRefund ? '환급액' : '추가납부액'}
            </p>
            <p
              className={`text-3xl font-bold ${isRefund ? 'text-emerald-600' : 'text-amber-600'}`}
            >
              {formatKRW(Math.abs(finalNum))}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              지방소득세 포함: {formatKRW(settlement.localTaxSettlement)}
            </p>
          </div>

          {/* Receipt status */}
          {settlement.withholdingReceipt && (
            <div className="flex items-center gap-2 text-sm text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              <span>
                원천징수영수증 발행완료 ({formatDate(settlement.withholdingReceipt.issuedAt)})
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:bg-muted rounded-lg"
          >
            {'닫기'}
          </button>
          <div className="flex gap-2">
            {settlement.status === 'confirmed' && (
              <button
                type="button"
                onClick={() => onIssueReceipt(settlement.id)}
                disabled={issuingReceipt}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-card border border-border hover:bg-background text-foreground rounded-lg disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                {issuingReceipt ? '발행 중...' : '영수증 발행'}
              </button>
            )}
            {(settlement.status === 'submitted' || settlement.status === 'hr_review') && (
              <button
                type="button"
                onClick={() => onConfirm(settlement.id)}
                disabled={confirming}
                className={`flex items-center gap-2 px-4 py-2 text-sm ${BUTTON_VARIANTS.primary} rounded-lg disabled:opacity-50`}
              >
                <CheckCircle2 className="h-4 w-4" />
                {confirming ? '처리 중...' : '확정'}
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
  }, [year, statusFilter])

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
    [fetchSettlements],
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
        throw new Error(json.error?.message ?? '영수증 발행에 실패했습니다.')
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
  }, [])

  const handleBulkConfirm = useCallback(async () => {
    const confirmableIds = settlements
      .filter(
        (s) =>
          selectedIds.has(s.id) &&
          (s.status === 'submitted' || s.status === 'hr_review'),
      )
      .map((s) => s.id)

    if (confirmableIds.length === 0) {
      setError('확정 가능한 정산이 없습니다.')
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
  }, [settlements, selectedIds, year, user.companyId, fetchSettlements])

  const handleBulkConfirmAll = useCallback(async () => {
    const confirmable = settlements.filter(
      (s) => s.status === 'submitted' || s.status === 'hr_review',
    )
    if (confirmable.length === 0) {
      setError('확정 가능한 정산이 없습니다.')
      return
    }

    confirm({ title: `${confirmable.length}건의 정산을 일괄 확정하시겠습니까?`, onConfirm: async () => {
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
  }, [settlements, year, user.companyId, fetchSettlements])

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
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">
            {year}년 연말정산 관리
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {/* Year selector */}
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value, 10))}
            className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none"
          >
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>

          {/* Bulk confirm button */}
          {confirmableCount > 0 && (
            <button
              type="button"
              onClick={handleBulkConfirmAll}
              disabled={bulkConfirming}
              className={`flex items-center gap-2 px-4 py-2 ${BUTTON_VARIANTS.primary} text-sm font-medium rounded-lg disabled:opacity-50`}
            >
              <CheckCircle2 className="h-4 w-4" />
              {bulkConfirming
                ? t('processing')
                : `일괄 확정 (${confirmableCount}건)`}
            </button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-auto p-1 hover:bg-red-200 rounded"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Progress Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { key: 'not_started', label: t('kr_kebafb8ec'), icon: Users, color: 'text-muted-foreground' },
          { key: 'in_progress', label: t('inProgress'), icon: Clock, color: 'text-amber-700' },
          { key: 'submitted', label: t('submitted'), icon: Send, color: 'text-primary/90' },
          { key: 'hr_review', label: t('hrReviewing'), icon: Eye, color: 'text-orange-700' },
          { key: 'confirmed', label: t('confirmed'), icon: CheckCircle2, color: 'text-emerald-600' },
        ].map(({ key, label, icon: Icon, color }) => (
          <div key={key} className="bg-card rounded-xl shadow-sm border border-border p-6">
            <div className={`flex items-center gap-1.5 text-xs ${color} mb-1`}>
              <Icon className="h-3.5 w-3.5" />
              <span>{label}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {summary[key as keyof StatusSummary]}
            </p>
          </div>
        ))}

        {/* Progress bar card */}
        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <p className="text-xs text-muted-foreground mb-1">{t('all_kec9984eb')}</p>
          <p className="text-2xl font-bold text-primary">{completionPct}%</p>
          <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${completionPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex border-b border-border">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setStatusFilter(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              statusFilter === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full ${
                  statusFilter === tab.key
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

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
              {['이름', '부서', '총급여', '환급/추가납부', '상태', '제출일', ''].map(
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
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  {t('kr_keb8db0ec_kebb688eb_keca491')}
                </td>
              </tr>
            ) : filteredSettlements.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  {t('kr_ked95b4eb_keca1b0ea_yearend_ke')}
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
                    <td className={cn(TABLE_STYLES.cell, "text-foreground font-medium")}>
                      {formatKRW(s.totalSalary)}
                    </td>
                    <td className={TABLE_STYLES.cell}>
                      <span
                        className={cn("font-semibold", isRefund ? 'text-emerald-600' : 'text-amber-600')}
                      >
                        {isRefund ? '+' : '-'} {formatKRW(Math.abs(finalNum))}
                      </span>
                    </td>
                    <td className={TABLE_STYLES.cell}>
                      <StatusBadge status={s.status} />
                    </td>
                    <td className={TABLE_STYLES.cell}>
                      {formatDate(s.submittedAt)}
                    </td>
                    <td className={TABLE_STYLES.cell} onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          type="button"
                          onClick={() => setSelectedSettlement(s)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted rounded-lg"
                        >
                          <Eye className="h-3.5 w-3.5" />
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
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-primary/90 bg-indigo-500/15 hover:bg-indigo-200 rounded-lg disabled:opacity-50"
                          >
                            <Download className="h-3.5 w-3.5" />
                            {t('kr_kec9881ec')}
                          </button>
                        )}
                        <ChevronRight className="h-3.5 w-3.5 text-[#CCC]" />
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="mt-4 px-4 py-3 border border-border rounded-lg bg-muted/50 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {selectedIds.size}건 선택됨
          </span>
          <button
            type="button"
            onClick={handleBulkConfirm}
            disabled={bulkConfirming}
            className={`flex items-center gap-2 px-4 py-2 text-sm ${BUTTON_VARIANTS.primary} rounded-lg disabled:opacity-50`}
          >
            <CheckCircle2 className="h-4 w-4" />
            {bulkConfirming ? t('processing') : '선택 항목 확정'}
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
