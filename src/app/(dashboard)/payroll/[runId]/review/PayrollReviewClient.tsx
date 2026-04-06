'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/hooks/use-toast'

// ═══════════════════════════════════════════════════════════
// GP#3-B: Payroll Anomaly Review UI — 3-탭 이상검토 페이지
// src/app/(dashboard)/payroll/[runId]/review/PayrollReviewClient.tsx
// ═══════════════════════════════════════════════════════════

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle, CheckCircle2, ShieldX, ShieldCheck,
  X, Download, ChevronDown, ChevronUp, ArrowLeft,
  TrendingUp, TrendingDown, Minus, Search,
  Users, DollarSign, AlertCircle, Clock,
} from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import { CARD_STYLES, TABLE_STYLES, MODAL_STYLES } from '@/lib/styles'
import { cn } from '@/lib/utils'
import { extractPrimaryAssignment } from '@/lib/employee/extract-primary-assignment'

// ─── Types ──────────────────────────────────────────────

interface AnomalyEmployee {
  id: string
  name: string
  employeeNo: string
  assignments?: Array<{
    department?: { id: string; name: string }
    position?: { id: string; titleKo: string }
  }>
}

interface Anomaly {
  id: string
  payrollRunId: string
  employeeId: string
  employee: AnomalyEmployee
  ruleCode: string
  severity: 'CRITICAL' | 'WARNING' | 'INFO'
  description: string
  currentValue: string | null
  previousValue: string | null
  threshold: string | null
  status: 'OPEN' | 'RESOLVED' | 'WHITELISTED'
  resolvedBy: string | null
  resolvedAt: string | null
  resolution: string | null
  whitelisted: boolean
  whitelistReason: string | null
}

interface AnomalySummary {
  total: number
  open: number
  resolved: number
  whitelisted: number
  bySeverity: { CRITICAL: number; WARNING: number; INFO: number }
  allResolved: boolean
}

interface ComparisonRow {
  employeeId: string
  employeeNo: string
  employeeName: string
  department: string
  position: string
  currentBaseSalary: number
  currentGross: number
  currentDeductions: number
  currentNet: number
  previousGross: number | null
  previousDeductions: number | null
  previousNet: number | null
  diffNet: number
  diffPercent: number
  changeReason: string | null
  hasAnomaly: boolean
  isManuallyAdjusted: boolean
}

interface PayrollRunInfo {
  id: string
  name: string
  yearMonth: string
  status: string
  headcount: number | null
  totalGross: string | number | null
  totalDeductions: string | number | null
  totalNet: string | number | null
  adjustmentCount: number | null
  allAnomaliesResolved: boolean | null
}

interface WhitelistEntry {
  id: string
  employeeId: string
  employee: AnomalyEmployee
  ruleCode: string
  whitelistReason: string | null
  resolvedBy: string | null
  resolvedAt: string | null
  payrollRun: { yearMonth: string }
}

// ─── Utilities ──────────────────────────────────────────

// fmt 함수는 컴포넌트 내부에서 t()를 사용하도록 이동 — fmtWithT 참조

const fmtPct = (n: number) => {
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(1)}%`
}

const SEVERITY_CONFIG = {
  CRITICAL: {
    border: 'border-l-4 border-red-500',
    bg: 'bg-destructive/5',
    badge: 'bg-destructive/10 text-destructive border-destructive/20',
    icon: <AlertTriangle className="h-4 w-4 text-red-500" />,
    labelKey: 'reviewPage.severityError' as const,
  },
  WARNING: {
    border: 'border-l-4 border-amber-500',
    bg: 'bg-amber-500/10',
    badge: 'bg-amber-500/15 text-amber-700 border-amber-300',
    icon: <AlertTriangle className="h-4 w-4 text-amber-500" />,
    labelKey: 'reviewPage.severityWarning' as const,
  },
  INFO: {
    border: 'border-l-4 border-blue-400',
    bg: 'bg-primary/5',
    badge: 'bg-primary/10 text-primary border-primary/20',
    icon: <AlertCircle className="h-4 w-4 text-blue-400" />,
    labelKey: 'reviewPage.severityInfo' as const,
  },
}

// ─── Anomaly Card ────────────────────────────────────────

interface AnomalyCardProps {
  anomaly: Anomaly
  runId: string
  onResolved: () => void
}

function AnomalyCard({ anomaly, runId, onResolved }: AnomalyCardProps) {
  const t = useTranslations('payroll')
  const tCommon = useTranslations('common')
  const cfg = SEVERITY_CONFIG[anomaly.severity]
  const [loading, setLoading] = useState(false)
  const [showWhitelistModal, setShowWhitelistModal] = useState(false)
  const [whitelistNote, setWhitelistNote] = useState('')
  const router = useRouter()

  const resolve = async (resolution: 'CONFIRMED_NORMAL' | 'CORRECTED' | 'WHITELISTED', note?: string) => {
    setLoading(true)
    try {
      await apiClient.put(`/api/v1/payroll/${runId}/anomalies/${anomaly.id}/resolve`, { resolution, note })
      onResolved()
    } catch (err) {
      toast({ title: t('reviewPage.anomalyFailed'), description: err instanceof Error ? err.message : '', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const primary = extractPrimaryAssignment(anomaly.employee.assignments ?? [])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dept = (primary as any)?.department?.name ?? '—'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pos = (primary as any)?.position?.titleKo ?? ''

  if (anomaly.status !== 'OPEN') return null

  return (
    <>
      <div className={`bg-card rounded-xl border border-border ${cfg.border} p-5 space-y-3`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {cfg.icon}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-foreground text-sm">
                  {anomaly.employee.name}
                </span>
                <span className="text-xs text-muted-foreground">{dept}{pos ? ` / ${pos}` : ''}</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cfg.badge}`}>
                  {t(cfg.labelKey)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{anomaly.description}</p>
            </div>
          </div>
        </div>

        {(anomaly.currentValue || anomaly.previousValue) && (
          <div className="flex items-center gap-6 text-xs text-muted-foreground bg-background rounded-lg p-3">
            {anomaly.currentValue != null && (
              <span>{t('reviewPage.thisMonth')} <strong className="text-foreground">{Number(anomaly.currentValue).toLocaleString()}</strong></span>
            )}
            {anomaly.previousValue != null && (
              <span>{t('reviewPage.prevMonth')} <strong className="text-foreground">{Number(anomaly.previousValue).toLocaleString()}</strong></span>
            )}
            {anomaly.threshold && (
              <span>{t('reviewPage.threshold')} <strong className="text-amber-500">{anomaly.threshold}</strong></span>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 pt-1 flex-wrap">
          <button
            onClick={() => resolve('CONFIRMED_NORMAL')}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-700 text-xs font-semibold hover:bg-emerald-200 transition-colors disabled:opacity-50"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {t('reviewPage.confirmNormal')}
          </button>
          <button
            onClick={() => router.push(`/payroll/adjustments`)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-muted-foreground text-xs font-medium hover:bg-muted transition-colors"
          >
            {t('reviewPage.editLink')}
          </button>
          <button
            onClick={() => setShowWhitelistModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-muted-foreground text-xs font-medium hover:bg-muted transition-colors"
          >
            <ShieldX className="h-3.5 w-3.5" />
            {t('reviewPage.addException')}
          </button>
        </div>
      </div>

      {showWhitelistModal && (
        <div className={MODAL_STYLES.container}>
          <div className="bg-card rounded-xl shadow-lg w-full max-w-md">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-foreground">{t('reviewPage.exceptionTitle')}</h3>
              <button onClick={() => setShowWhitelistModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('reviewPage.exceptionDesc', { name: anomaly.employee.name, rule: anomaly.ruleCode })}
              </p>
              <textarea
                value={whitelistNote}
                onChange={(e) => setWhitelistNote(e.target.value)}
                placeholder={'placeholderExceptionReason'}
                rows={3}
                className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 resize-none"
              />
            </div>
            <div className="p-5 border-t border-border flex justify-end gap-2">
              <button
                onClick={() => setShowWhitelistModal(false)}
                className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted"
              >
                {tCommon('cancel')}
              </button>
              <button
                onClick={async () => {
                  await resolve('WHITELISTED', whitelistNote)
                  setShowWhitelistModal(false)
                }}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
              >
                <ShieldCheck className="h-4 w-4 inline mr-1" />
                {t('reviewPage.addException')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Employee Side Panel ─────────────────────────────────

interface PayrollDetail {
  baseSalary: number
  overtimePay: number
  bonus: number
  allowances: number
  grossPay: number
  deductions: number
  netPay: number
  isManuallyAdjusted: boolean
  adjustmentReason: string | null
}

interface SidePanelProps {
  row: ComparisonRow
  detail?: PayrollDetail | null
  onClose: () => void
}

function EmployeeSidePanel({ row, detail, onClose }: SidePanelProps) {
  const t = useTranslations('payroll')
  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/20" onClick={onClose} />
      <div className="w-80 bg-card shadow-lg flex flex-col h-full overflow-y-auto">
        <div className="sticky top-0 bg-card p-4 border-b border-border flex items-center justify-between">
          <div>
            <p className="font-bold text-foreground">{row.employeeName}</p>
            <p className="text-xs text-muted-foreground">{row.department}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {detail ? (
          <div className="p-4 space-y-4">
            {/* 지급 */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('reviewPage.earnings')}</p>
              <div className="space-y-1.5">
                {[
                  [t('basePay'), detail.baseSalary],
                  [t('overtimePay'), detail.overtimePay],
                  [t('bonusPay'), detail.bonus],
                  [t('allowances'), detail.allowances],
                ].map(([label, value]) => (
                  Number(value) > 0 && (
                    <div key={label as string} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{label as string}</span>
                      <span className="text-foreground">{Number(value).toLocaleString()}</span>
                    </div>
                  )
                ))}
                <div className="border-t border-border pt-1.5 flex justify-between text-sm font-semibold">
                  <span className="text-emerald-600">{t('reviewPage.earningsTotal')}</span>
                  <span className="text-emerald-600">{detail.grossPay.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* 공제 */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('reviewPage.deductionsTotal')}</p>
              <div className="border-t border-border pt-1.5 flex justify-between text-sm font-semibold">
                <span className="text-destructive">{t('reviewPage.deductionsTotal')}</span>
                <span className="text-destructive">-{detail.deductions.toLocaleString()}</span>
              </div>
            </div>

            {/* 실수령액 */}
            <div className="bg-tertiary-container/10 rounded-xl p-4">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-foreground">{t('reviewPage.netPayLabel')}</span>
                <span className="text-xl font-bold text-emerald-600">{t('reviewPage.netPayAmount', { amount: detail.netPay.toLocaleString() })}</span>
              </div>
            </div>

            {detail.isManuallyAdjusted && (
              <div className="bg-amber-500/15 rounded-lg p-3 text-xs text-amber-700">
                ✏️ {t('reviewPage.adjustmentNote', { reason: detail.adjustmentReason ?? '' })}
              </div>
            )}

            {/* 전월 비교 */}
            {row.previousNet != null && (
              <div className="border-t border-border pt-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('reviewPage.prevComparison')}</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('reviewPage.prevNetPay')}</span>
                    <span>{t('fmt.amountWon', { n: row.previousNet!.toLocaleString() })}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span className="text-muted-foreground">{t('reviewPage.changeRate')}</span>
                    <span className={row.diffNet > 0 ? 'text-emerald-600' : row.diffNet < 0 ? 'text-destructive' : 'text-muted-foreground'}>
                      {t('reviewPage.changeAmount', { amount: `${row.diffNet > 0 ? '+' : ''}${row.diffNet.toLocaleString()}`, pct: fmtPct(row.diffPercent) })}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4">
            <div className="space-y-3">
              {[
                [t('reviewPage.currentNetPay'), row.currentNet],
                [t('basePay'), row.currentBaseSalary],
                [t('reviewPage.prevNetPay'), row.previousNet ?? '—'],
              ].map(([label, value]) => (
                <div key={label as string} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{label as string}</span>
                  <span className="font-medium text-foreground">
                    {typeof value === 'number' ? t('fmt.amountWon', { n: value.toLocaleString() }) : String(value)}
                  </span>
                </div>
              ))}
              {row.diffNet !== 0 && (
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-muted-foreground">{t('reviewPage.changeRate')}</span>
                  <span className={row.diffNet > 0 ? 'text-emerald-600' : 'text-destructive'}>
                    {t('reviewPage.changeAmount', { amount: `${row.diffNet > 0 ? '+' : ''}${row.diffNet.toLocaleString()}`, pct: fmtPct(row.diffPercent) })}
                  </span>
                </div>
              )}
              {row.changeReason && (
                <div className="text-xs text-muted-foreground bg-background rounded-lg p-2 mt-2">
                  {t('reviewPage.reason', { reason: row.changeReason ?? '' })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────

interface Props {
  user: SessionUser
  runId: string
}

export default function PayrollReviewClient({user: _user, runId }: Props) {
  const t = useTranslations('payroll')
  const tCommon = useTranslations('common')
  const router = useRouter()

  // 금액 포매팅 (i18n)
  const fmt = (n: number | null | undefined) =>
    n == null ? '—' : t('fmt.amountWon', { n: n.toLocaleString() })
  const [run, setRun] = useState<PayrollRunInfo | null>(null)
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [anomalySummary, setAnomalySummary] = useState<AnomalySummary | null>(null)
  const [comparisonRows, setComparisonRows] = useState<ComparisonRow[]>([])
  const [comparisonSummary, setComparisonSummary] = useState<Record<string, number | string> | null>(null)
  const [whitelistEntries, setWhitelistEntries] = useState<WhitelistEntry[]>([])
  const [activeTab, setActiveTab] = useState<'anomalies' | 'comparison' | 'whitelist'>('anomalies')
  const [loading, setLoading] = useState(true)
  const [selectedRow, setSelectedRow] = useState<ComparisonRow | null>(null)
  const [anomalyOnly, setAnomalyOnly] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'diffPercent' | 'currentNet'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [submitNote, setSubmitNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [bulkResolving, setBulkResolving] = useState(false)
  const [showDownloadMenu, setShowDownloadMenu] = useState(false)
  const downloadRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (downloadRef.current && !downloadRef.current.contains(e.target as Node)) {
        setShowDownloadMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const fetchRun = useCallback(async () => {
    try {
      const res = await apiClient.get<PayrollRunInfo>(`/api/v1/payroll/runs/${runId}`)
      setRun(res.data)
    } catch (err) {
      toast({ title: t('reviewPage.loadRunFailed'), description: err instanceof Error ? err.message : '', variant: 'destructive' })
    }
  }, [runId])

  const fetchAnomalies = useCallback(async () => {
    try {
      const res = await apiClient.get<{ anomalies: Anomaly[]; summary: AnomalySummary }>(
        `/api/v1/payroll/${runId}/anomalies`, { limit: 100 }
      )
      setAnomalies(res.data.anomalies)
      setAnomalySummary(res.data.summary)
    } catch (err) {
      toast({ title: t('reviewPage.loadAnomalyFailed'), description: err instanceof Error ? err.message : '', variant: 'destructive' })
    }
  }, [runId])

  const fetchComparison = useCallback(async () => {
    try {
      const params: Record<string, string | number | undefined> = { sortBy, sortOrder }
      if (deptFilter) params.department = deptFilter
      if (anomalyOnly) params.anomalyOnly = 1
      const res = await apiClient.get<{ rows: ComparisonRow[]; summary: Record<string, number | string> }>(
        `/api/v1/payroll/${runId}/comparison`, params
      )
      setComparisonRows(res.data.rows)
      setComparisonSummary(res.data.summary)
    } catch (err) {
      toast({ title: t('reviewPage.loadComparisonFailed'), description: err instanceof Error ? err.message : '', variant: 'destructive' })
    }
  }, [runId, sortBy, sortOrder, deptFilter, anomalyOnly])

  const fetchWhitelist = useCallback(async () => {

    if (!run?.id) return
    try {
      const res = await apiClient.get<{ items: WhitelistEntry[] }>(
        `/api/v1/payroll/whitelist`, { companyId: run.id }
      )
      setWhitelistEntries(res.data.items ?? [])
    } catch (err) {
      toast({ title: t('reviewPage.loadWhitelistFailed'), description: err instanceof Error ? err.message : '', variant: 'destructive' })
    }
  }, [run?.id])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await fetchRun()
      await fetchAnomalies()
      setLoading(false)
    }
    load()
  }, [fetchRun, fetchAnomalies])

  useEffect(() => {
    if (activeTab === 'comparison') fetchComparison()
    if (activeTab === 'whitelist') fetchWhitelist()
  }, [activeTab, fetchComparison, fetchWhitelist])

  useEffect(() => {
    if (activeTab === 'comparison') fetchComparison()
  }, [sortBy, sortOrder, deptFilter, anomalyOnly, activeTab, fetchComparison])

  const handleBulkResolveInfo = async () => {
    const infoAnomalies = anomalies.filter((a) => a.severity === 'INFO' && a.status === 'OPEN')
    if (infoAnomalies.length === 0) return
    setBulkResolving(true)
    try {
      await apiClient.post(`/api/v1/payroll/${runId}/anomalies/bulk-resolve`, {
        anomalyIds: infoAnomalies.map((a) => a.id),
        resolution: 'CONFIRMED_NORMAL',
      })
      await fetchAnomalies()
      await fetchRun()
    } catch (err) {
      toast({ title: t('reviewPage.bulkFailed'), description: err instanceof Error ? err.message : '', variant: 'destructive' })
    } finally {
      setBulkResolving(false)
    }
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      await apiClient.post(`/api/v1/payroll/${runId}/submit-for-approval`, { note: submitNote })
      setShowSubmitModal(false)
      router.push('/payroll')
    } catch (err) {
      toast({ title: t('reviewPage.approvalRequestFailed'), description: err instanceof Error ? err.message : '', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemoveWhitelist = async (anomalyId: string) => {
    try {
      await apiClient.delete(`/api/v1/payroll/whitelist/${anomalyId}`)
      await fetchWhitelist()
    } catch (err) {
      toast({ title: t('reviewPage.removeWhitelistFailed'), description: err instanceof Error ? err.message : '', variant: 'destructive' })
    }
  }

  const triggerDownload = (url: string) => {
    const a = document.createElement('a')
    a.href = url
    a.click()
    setShowDownloadMenu(false)
  }

  const filteredRows = comparisonRows.filter((r) =>
    r.employeeName.includes(searchText) || r.department.includes(searchText)
  )

  const depts = [...new Set(comparisonRows.map((r) => r.department))].sort()
  const openAnomalies = anomalies.filter((a) => a.status === 'OPEN')
  const infoCount = openAnomalies.filter((a) => a.severity === 'INFO').length
  const allResolved = anomalySummary?.allResolved ?? run?.allAnomaliesResolved ?? false

  if (loading || !run) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/payroll')} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em]">{run.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm text-muted-foreground">{run.yearMonth}</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/15 text-primary/90 border border-indigo-200">
                {t('anomalies_keca491')}
              </span>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button
          onClick={() => setShowSubmitModal(true)}
          disabled={!allResolved}
          title={!allResolved ? t('reviewPage.submitTooltip', { count: anomalySummary?.open ?? 0 }) : t('reviewPage.approvalRequest')}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors ${allResolved
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
              : 'bg-border text-muted-foreground cursor-not-allowed'
            }`}
        >
          <CheckCircle2 className="h-4 w-4" />
          {t('reviewPage.approvalRequest')}
          {!allResolved && anomalySummary && (
            <span className="bg-white/20 rounded-full px-1.5 text-xs">{anomalySummary.open}</span>
          )}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t('kr_kecb49d_keab889ec'), value: fmt(Number(run.totalGross ?? 0)), icon: <DollarSign className="h-4 w-4 text-emerald-600" /> },
          { label: t('kr_kec9db8ec'), value: `${run.headcount ?? 0}명`, icon: <Users className="h-4 w-4 text-primary/90" /> },
          { label: t('kr_kec9db4ec_ked95adeb'), value: `${anomalySummary?.open ?? 0}건`, icon: <AlertTriangle className="h-4 w-4 text-amber-500" />, highlight: (anomalySummary?.open ?? 0) > 0 },
          { label: t('adjustments'), value: `${run.adjustmentCount ?? 0}건`, icon: <Clock className="h-4 w-4 text-muted-foreground" /> },
        ].map((kpi) => (
          <div key={kpi.label} className={`bg-card rounded-xl border p-5 ${kpi.highlight ? 'border-amber-500' : 'border-border'}`}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              {kpi.icon}
            </div>
            <p className={`text-2xl font-bold leading-tight ${kpi.highlight ? 'text-amber-500' : 'text-foreground'}`}>
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* Alert Banner */}
      {!allResolved && anomalySummary && anomalySummary.open > 0 && (
        <div className="bg-amber-500/15 border border-amber-300 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-700 font-medium">
            {t('reviewPage.alertBanner', { count: anomalySummary.open })}
            {anomalySummary.bySeverity.CRITICAL > 0 && (
              <span className="ml-2 text-destructive">{t('reviewPage.alertCritical', { count: anomalySummary.bySeverity.CRITICAL })}</span>
            )}
          </p>
        </div>
      )}

      {allResolved && (
        <div className="bg-emerald-500/15 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
          <p className="text-sm text-emerald-700 font-medium">{t('kr_kebaaa8eb_kec9db4ec_ked95adeb_')}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-border flex gap-6">
        {([
          ['anomalies', t('reviewPage.anomaliesTab', { count: anomalySummary?.open ?? 0 })],
          ['comparison', t('reviewPage.comparisonTab', { count: run.headcount ?? 0 })],
          ['whitelist', t('reviewPage.whitelistTab', { count: whitelistEntries.length })],
        ] as ['anomalies' | 'comparison' | 'whitelist', string][]).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-2.5 text-sm font-${activeTab === tab ? 'bold border-b-2 border-foreground text-foreground' : 'medium text-muted-foreground hover:text-foreground'} transition-colors`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab: 이상항목 ───────────────────────────────────────── */}
      {activeTab === 'anomalies' && (
        <div className="space-y-4">
          {anomalySummary && anomalySummary.total > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-xs">
                {anomalySummary.bySeverity.CRITICAL > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
                    <AlertTriangle className="h-3 w-3" /> {t('reviewPage.critical', { count: anomalySummary.bySeverity.CRITICAL })}
                  </span>
                )}
                {anomalySummary.bySeverity.WARNING > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-700 border border-amber-300">
                    <AlertTriangle className="h-3 w-3" /> {t('reviewPage.warning', { count: anomalySummary.bySeverity.WARNING })}
                  </span>
                )}
                {anomalySummary.bySeverity.INFO > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                    <AlertCircle className="h-3 w-3" /> {t('reviewPage.info', { count: anomalySummary.bySeverity.INFO })}
                  </span>
                )}
              </div>
              {infoCount > 0 && (
                <button
                  onClick={handleBulkResolveInfo}
                  disabled={bulkResolving}
                  className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-50"
                >
                  {t('reviewPage.bulkConfirmInfo', { count: infoCount })}
                </button>
              )}
            </div>
          )}

          {openAnomalies.length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto mb-3" />
              <EmptyState />
            </div>
          ) : (
            openAnomalies
              .sort((a, b) => {
                const order = { CRITICAL: 0, WARNING: 1, INFO: 2 }
                return order[a.severity] - order[b.severity]
              })
              .map((anomaly) => (
                <AnomalyCard
                  key={anomaly.id}
                  anomaly={anomaly}
                  runId={runId}
                  onResolved={async () => { await fetchAnomalies(); await fetchRun() }}
                />
              ))
          )}
        </div>
      )}

      {/* ── Tab: 전체직원 (비교표) ──────────────────────────────── */}
      {activeTab === 'comparison' && (
        <div className="space-y-4">
          {/* Comparison KPIs */}
          {comparisonSummary && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: t('kr_keca69dea'), value: comparisonSummary.employeesIncreased, color: 'text-emerald-600', icon: <TrendingUp className="h-4 w-4 text-emerald-600" /> },
                { label: t('kr_keab090ec'), value: comparisonSummary.employeesDecreased, color: 'text-destructive', icon: <TrendingDown className="h-4 w-4 text-destructive" /> },
                { label: t('kr_keb8f99ec'), value: comparisonSummary.employeesUnchanged, color: 'text-muted-foreground', icon: <Minus className="h-4 w-4 text-muted-foreground" /> },
              ].map((item) => (
                <div key={item.label} className={`${CARD_STYLES.kpi} flex items-center gap-3`}>
                  {item.icon}
                  <div>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className={`text-xl font-bold ${item.color}`}>{String(item.value)}명</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder={tCommon('searchPlaceholder')}
                className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
            </div>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg text-sm text-muted-foreground bg-card"
            >
              <option value="">{t('all_department')}</option>
              {depts.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <label className="inline-flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={anomalyOnly}
                onChange={(e) => setAnomalyOnly(e.target.checked)}
                className="w-4 h-4 rounded border-border text-primary"
              />
              {t('kr_kec9db4ec')}
            </label>

            {/* Download dropdown */}
            <div className="relative" ref={downloadRef}>
              <button
                onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted"
              >
                <Download className="h-4 w-4" />
                {t('kr_kec9791ec')}
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {showDownloadMenu && (
                <div className="absolute right-0 top-full mt-1 bg-card rounded-xl shadow-lg border border-border py-1 w-44 z-10">
                  {[
                    { label: t('kr_keca084ec_keb8c80eb_kebb984ea'), href: `/api/v1/payroll/${runId}/export/comparison` },
                    { label: t('kr_keab889ec'), href: `/api/v1/payroll/${runId}/export/ledger` },
                    { label: t('kr_kec9db8ea_keca084ed'), href: `/api/v1/payroll/${runId}/export/journal` },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={() => triggerDownload(item.href)}
                      className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-muted"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Comparison Table */}
          <div className={TABLE_STYLES.wrapper}>
            <table className={TABLE_STYLES.table}>
              <thead>
                <tr className={TABLE_STYLES.header}>
                  {[
                    { label: t('name'), key: 'name', align: 'left' },
                    { label: t('department'), key: null, align: 'left' },
                    { label: t('kr_kec8ba4ec'), key: 'currentNet', align: 'right' },
                    { label: t('kr_keca084ec'), key: null, align: 'right' },
                    { label: t('kr_kebb380eb'), key: 'diffPercent', align: 'right' },
                    { label: t('kr_kec82acec'), key: null, align: 'left' },
                  ].map(({ label, key, align }) => (
                    <th
                      key={label}
                      onClick={key ? () => {
                        if (sortBy === key) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                        else { setSortBy(key as typeof sortBy); setSortOrder('asc') }
                      } : undefined}
                      className={cn(
                        align === 'right' ? TABLE_STYLES.headerCellRight : TABLE_STYLES.headerCell,
                        key ? 'cursor-pointer hover:text-foreground' : '',
                        align === 'right' && 'justify-end'
                      )}
                    >
                      <span className={cn("inline-flex items-center gap-1", align === 'right' && "justify-end w-full")}>
                        {label}
                        {key && sortBy === key && (sortOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-sm text-muted-foreground">{t('search_keab2b0ea_kec9786ec')}</td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr
                      key={row.employeeId}
                      onClick={() => setSelectedRow(row)}
                      className={cn(TABLE_STYLES.rowClickable, row.hasAnomaly ? 'bg-destructive/5 hover:bg-destructive/5' : '')}
                    >
                      <td className={TABLE_STYLES.cell}>
                        <div className="flex items-center gap-2">
                          {row.hasAnomaly && <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />}
                          <p className="font-medium">{row.employeeName}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">{row.employeeNo}</p>
                      </td>
                      <td className={TABLE_STYLES.cellMuted}>{row.department}</td>
                      <td className={cn(TABLE_STYLES.cellRight, "font-semibold")}>
                        {row.currentNet.toLocaleString()}
                      </td>
                      <td className={cn(TABLE_STYLES.cellRight, "text-muted-foreground")}>
                        {row.previousNet != null ? row.previousNet.toLocaleString() : t('reviewPage.newEmployee')}
                      </td>
                      <td className={TABLE_STYLES.cellRight}>
                        {row.previousNet != null ? (
                          <span className={cn("font-medium", row.diffNet > 0 ? 'text-emerald-600' : row.diffNet < 0 ? 'text-destructive' : 'text-muted-foreground')}>
                            {row.diffNet > 0 && '+'}
                            {row.diffNet.toLocaleString()} ({fmtPct(row.diffPercent)})
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className={cn(TABLE_STYLES.cellMuted, "text-xs max-w-32 truncate")}>
                        {row.changeReason ?? '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab: 예외목록 ────────────────────────────────────────── */}
      {activeTab === 'whitelist' && (
        <div className={TABLE_STYLES.wrapper}>
          <table className={TABLE_STYLES.table}>
            <thead>
              <tr className={TABLE_STYLES.header}>
                <th className={TABLE_STYLES.headerCell}>{t('kr_keca781ec')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('kr_keab79cec')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('register_kec82acec')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('register_month')}</th>
                <th className={TABLE_STYLES.headerCell} />
              </tr>
            </thead>
            <tbody>
              {whitelistEntries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <ShieldCheck className="h-10 w-10 text-border mx-auto mb-3" />
                    <EmptyState />
                  </td>
                </tr>
              ) : (
                whitelistEntries.map((entry) => (
                  <tr key={entry.id} className={TABLE_STYLES.row}>
                    <td className={cn(TABLE_STYLES.cell, "font-medium")}>{entry.employee.name}</td>
                    <td className={TABLE_STYLES.cell}>
                      <span className="px-2 py-1 bg-muted rounded text-xs font-mono tabular-nums text-muted-foreground">{entry.ruleCode}</span>
                    </td>
                    <td className={TABLE_STYLES.cellMuted}>{entry.whitelistReason ?? '—'}</td>
                    <td className={cn(TABLE_STYLES.cellMuted, "text-xs")}>{entry.payrollRun?.yearMonth}</td>
                    <td className={cn(TABLE_STYLES.cellRight, "w-20")}>
                      <button
                        onClick={() => handleRemoveWhitelist(entry.id)}
                        className="text-xs text-destructive hover:underline"
                      >
                        {t('kr_ked95b4ec')}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Employee Side Panel ────────────────────────────────── */}
      {selectedRow && (
        <EmployeeSidePanel
          row={selectedRow}
          detail={null}
          onClose={() => setSelectedRow(null)}
        />
      )}

      {/* ── Submit for Approval Modal ──────────────────────────── */}
      {showSubmitModal && (
        <div className={MODAL_STYLES.container}>
          <div className={MODAL_STYLES.content.md}>
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h3 className="font-bold text-lg text-foreground">{t('approve_kec9a94ec')}</h3>
              <button onClick={() => setShowSubmitModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-background rounded-xl p-4 space-y-2 text-sm">
                {[
                  [t('reviewPage.summaryMonth'), run.yearMonth],
                  [t('kr_kec9db8ec'), t('reviewPage.summaryHeadcount', { count: run.headcount ?? 0 })],
                  [t('netPay'), fmt(Number(run.totalNet ?? 0))],
                  [t('adjustments'), t('reviewPage.summaryAdjustments', { count: run.adjustmentCount ?? 0 })],
                ].map(([label, value]) => (
                  <div key={label as string} className="flex justify-between">
                    <span className="text-muted-foreground">{label as string}</span>
                    <span className="font-semibold text-foreground">{value as string}</span>
                  </div>
                ))}
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">{t('kr_keba994eb_kec84a0ed')}</label>
                <textarea
                  value={submitNote}
                  onChange={(e) => setSubmitNote(e.target.value)}
                  placeholder={tCommon('placeholderApprovalMemo')}
                  rows={3}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 resize-none"
                />
              </div>
            </div>
            <div className="p-5 border-t border-border flex justify-end gap-2">
              <button
                onClick={() => setShowSubmitModal(false)}
                className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50"
              >
                {submitting ? t('reviewPage.requesting') : t('reviewPage.approvalRequestSend')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
