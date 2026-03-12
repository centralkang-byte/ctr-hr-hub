'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
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
  TrendingUp, TrendingDown, Minus, Filter, Search,
  Users, DollarSign, AlertCircle, Clock,
} from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import { CARD_STYLES, TABLE_STYLES } from '@/lib/styles'

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

const fmt = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('ko-KR') + '원'

const fmtPct = (n: number) => {
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(1)}%`
}

const SEVERITY_CONFIG = {
  CRITICAL: {
    border: 'border-l-4 border-[#EF4444]',
    bg: 'bg-[#FEF2F2]',
    badge: 'bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]',
    icon: <AlertTriangle className="h-4 w-4 text-[#EF4444]" />,
    label: '위험',
  },
  WARNING: {
    border: 'border-l-4 border-[#F59E0B]',
    bg: 'bg-[#FFFBEB]',
    badge: 'bg-[#FEF3C7] text-[#B45309] border-[#FCD34D]',
    icon: <AlertTriangle className="h-4 w-4 text-[#F59E0B]" />,
    label: '경고',
  },
  INFO: {
    border: 'border-l-4 border-[#60A5FA]',
    bg: 'bg-[#EFF6FF]',
    badge: 'bg-[#DBEAFE] text-[#1D4ED8] border-[#BFDBFE]',
    icon: <AlertCircle className="h-4 w-4 text-[#60A5FA]" />,
    label: '정보',
  },
}

// ─── Anomaly Card ────────────────────────────────────────

interface AnomalyCardProps {
  anomaly: Anomaly
  runId: string
  onResolved: () => void
}

function AnomalyCard({ anomaly, runId, onResolved }: AnomalyCardProps) {
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
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const dept = anomaly.employee.assignments?.[0]?.department?.name ?? '—'
  const pos = (anomaly.employee.assignments?.[0]?.position as unknown as { titleKo?: string } | undefined)?.titleKo ?? ''

  if (anomaly.status !== 'OPEN') return null

  return (
    <>
      <div className={`bg-white rounded-xl border border-[#E8E8E8] ${cfg.border} p-5 space-y-3`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {cfg.icon}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-[#1A1A1A] text-sm">
                  {anomaly.employee.name}
                </span>
                <span className="text-xs text-[#999]">{dept}{pos ? ` / ${pos}` : ''}</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cfg.badge}`}>
                  {cfg.label}
                </span>
              </div>
              <p className="text-sm text-[#555] mt-1">{anomaly.description}</p>
            </div>
          </div>
        </div>

        {(anomaly.currentValue || anomaly.previousValue) && (
          <div className="flex items-center gap-6 text-xs text-[#666] bg-[#FAFAFA] rounded-lg p-3">
            {anomaly.currentValue != null && (
              <span>이번 달: <strong className="text-[#1A1A1A]">{Number(anomaly.currentValue).toLocaleString()}</strong></span>
            )}
            {anomaly.previousValue != null && (
              <span>전월: <strong className="text-[#1A1A1A]">{Number(anomaly.previousValue).toLocaleString()}</strong></span>
            )}
            {anomaly.threshold && (
              <span>기준: <strong className="text-[#F59E0B]">{anomaly.threshold}</strong></span>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 pt-1 flex-wrap">
          <button
            onClick={() => resolve('CONFIRMED_NORMAL')}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#D1FAE5] text-[#047857] text-xs font-semibold hover:bg-[#A7F3D0] transition-colors disabled:opacity-50"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            정상 확인
          </button>
          <button
            onClick={() => router.push(`/payroll/adjustments`)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D4D4D4] text-[#555] text-xs font-medium hover:bg-[#F5F5F5] transition-colors"
          >
            수정 →
          </button>
          <button
            onClick={() => setShowWhitelistModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D4D4D4] text-[#555] text-xs font-medium hover:bg-[#F5F5F5] transition-colors"
          >
            <ShieldX className="h-3.5 w-3.5" />
            예외 등록
          </button>
        </div>
      </div>

      {showWhitelistModal && (
        <div className={MODAL_STYLES.container}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-5 border-b border-[#E8E8E8] flex items-center justify-between">
              <h3 className="font-semibold text-[#1A1A1A]">예외 등록</h3>
              <button onClick={() => setShowWhitelistModal(false)} className="text-[#999] hover:text-[#333]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-[#555]">
                <strong>{anomaly.employee.name}</strong>의 <strong>{anomaly.ruleCode}</strong> 규칙을 예외 처리합니다.
              </p>
              <textarea
                value={whitelistNote}
                onChange={(e) => setWhitelistNote(e.target.value)}
                placeholder="예외 사유를 입력하세요 (예: 대표이사 승인된 특별 근무)"
                rows={3}
                className="w-full px-3 py-2.5 border border-[#E0E0E0] rounded-lg text-sm focus:border-[#00C853] focus:ring-2 focus:ring-[#00C853]/10 resize-none"
              />
            </div>
            <div className="p-5 border-t border-[#E8E8E8] flex justify-end gap-2">
              <button
                onClick={() => setShowWhitelistModal(false)}
                className="px-4 py-2 rounded-lg border border-[#D4D4D4] text-sm text-[#555] hover:bg-[#F5F5F5]"
              >
                취소
              </button>
              <button
                onClick={async () => {
                  await resolve('WHITELISTED', whitelistNote)
                  setShowWhitelistModal(false)
                }}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-[#00C853] text-white text-sm font-semibold hover:bg-[#00A844] disabled:opacity-50"
              >
                <ShieldCheck className="h-4 w-4 inline mr-1" />
                예외 등록
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
  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/20" onClick={onClose} />
      <div className="w-80 bg-white shadow-2xl flex flex-col h-full overflow-y-auto">
        <div className="sticky top-0 bg-white p-4 border-b border-[#E8E8E8] flex items-center justify-between">
          <div>
            <p className="font-bold text-[#1A1A1A]">{row.employeeName}</p>
            <p className="text-xs text-[#999]">{row.department}</p>
          </div>
          <button onClick={onClose} className="text-[#999] hover:text-[#333]">
            <X className="h-5 w-5" />
          </button>
        </div>

        {detail ? (
          <div className="p-4 space-y-4">
            {/* 지급 */}
            <div>
              <p className="text-xs font-semibold text-[#999] uppercase tracking-wider mb-2">지급</p>
              <div className="space-y-1.5">
                {[
                  ['기본급', detail.baseSalary],
                  ['연장수당', detail.overtimePay],
                  ['상여금', detail.bonus],
                  ['수당', detail.allowances],
                ].map(([label, value]) => (
                  Number(value) > 0 && (
                    <div key={label as string} className="flex justify-between text-sm">
                      <span className="text-[#666]">{label as string}</span>
                      <span className="text-[#1A1A1A]">{Number(value).toLocaleString()}</span>
                    </div>
                  )
                ))}
                <div className="border-t border-[#E8E8E8] pt-1.5 flex justify-between text-sm font-semibold">
                  <span className="text-[#059669]">지급합계</span>
                  <span className="text-[#059669]">{detail.grossPay.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* 공제 */}
            <div>
              <p className="text-xs font-semibold text-[#999] uppercase tracking-wider mb-2">공제</p>
              <div className="border-t border-[#E8E8E8] pt-1.5 flex justify-between text-sm font-semibold">
                <span className="text-[#DC2626]">공제합계</span>
                <span className="text-[#DC2626]">-{detail.deductions.toLocaleString()}</span>
              </div>
            </div>

            {/* 실수령액 */}
            <div className="bg-[#F0FDF4] rounded-xl p-4">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-[#1A1A1A]">실수령액</span>
                <span className="text-xl font-bold text-[#059669]">{detail.netPay.toLocaleString()}원</span>
              </div>
            </div>

            {detail.isManuallyAdjusted && (
              <div className="bg-[#FEF3C7] rounded-lg p-3 text-xs text-[#B45309]">
                ✏️ 수동 조정: {detail.adjustmentReason}
              </div>
            )}

            {/* 전월 비교 */}
            {row.previousNet != null && (
              <div className="border-t border-[#E8E8E8] pt-3">
                <p className="text-xs font-semibold text-[#999] uppercase tracking-wider mb-2">전월 비교</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#666]">전월 실수령</span>
                    <span>{row.previousNet.toLocaleString()}원</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span className="text-[#666]">변동</span>
                    <span className={row.diffNet > 0 ? 'text-[#059669]' : row.diffNet < 0 ? 'text-[#DC2626]' : 'text-[#999]'}>
                      {row.diffNet > 0 ? '+' : ''}{row.diffNet.toLocaleString()}원
                      &nbsp;({fmtPct(row.diffPercent)})
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
                ['현재 실수령', row.currentNet],
                ['기본급', row.currentBaseSalary],
                ['전월 실수령', row.previousNet ?? '—'],
              ].map(([label, value]) => (
                <div key={label as string} className="flex justify-between text-sm">
                  <span className="text-[#666]">{label as string}</span>
                  <span className="font-medium text-[#1A1A1A]">
                    {typeof value === 'number' ? value.toLocaleString() + '원' : String(value)}
                  </span>
                </div>
              ))}
              {row.diffNet !== 0 && (
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-[#666]">변동</span>
                  <span className={row.diffNet > 0 ? 'text-[#059669]' : 'text-[#DC2626]'}>
                    {row.diffNet > 0 ? '+' : ''}{row.diffNet.toLocaleString()}원 ({fmtPct(row.diffPercent)})
                  </span>
                </div>
              )}
              {row.changeReason && (
                <div className="text-xs text-[#999] bg-[#FAFAFA] rounded-lg p-2 mt-2">
                  사유: {row.changeReason}
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

export default function PayrollReviewClient({
  const tCommon = useTranslations('common')
  const t = useTranslations('payroll') user: _user, runId }: Props) {
  const router = useRouter()
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
    } catch { /* silent */ }
  }, [runId])

  const fetchAnomalies = useCallback(async () => {
    try {
      const res = await apiClient.get<{ anomalies: Anomaly[]; summary: AnomalySummary }>(
        `/api/v1/payroll/${runId}/anomalies`, { limit: 100 }
      )
      setAnomalies(res.data.anomalies)
      setAnomalySummary(res.data.summary)
    } catch { /* silent */ }
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
    } catch { /* silent */ }
  }, [runId, sortBy, sortOrder, deptFilter, anomalyOnly])

  const fetchWhitelist = useCallback(async () => {
    if (!run?.id) return
    try {
      const res = await apiClient.get<{ items: WhitelistEntry[] }>(
        `/api/v1/payroll/whitelist`, { companyId: run.id }
      )
      setWhitelistEntries(res.data.items ?? [])
    } catch { /* silent */ }
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
    } catch { /* silent */ } finally {
      setBulkResolving(false)
    }
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      await apiClient.post(`/api/v1/payroll/${runId}/submit-for-approval`, { note: submitNote })
      setShowSubmitModal(false)
      router.push('/payroll')
    } catch { /* silent */ } finally {
      setSubmitting(false)
    }
  }

  const handleRemoveWhitelist = async (anomalyId: string) => {
    try {
      await apiClient.delete(`/api/v1/payroll/whitelist/${anomalyId}`)
      await fetchWhitelist()
    } catch { /* silent */ }
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
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-4 border-[#00C853] border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/payroll')} className="text-[#999] hover:text-[#333]">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-[#1A1A1A] tracking-[-0.02em]">{run.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm text-[#666]">{run.yearMonth}</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E0E7FF] text-[#4338CA] border border-[#C7D2FE]">
                이상 검토 중
              </span>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button
          onClick={() => setShowSubmitModal(true)}
          disabled={!allResolved}
          title={!allResolved ? `미처리 이상항목 ${anomalySummary?.open ?? 0}건이 있습니다` : '승인 요청'}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors ${allResolved
              ? 'bg-[#059669] hover:bg-[#047857] text-white'
              : 'bg-[#E8E8E8] text-[#999] cursor-not-allowed'
            }`}
        >
          <CheckCircle2 className="h-4 w-4" />
          승인 요청
          {!allResolved && anomalySummary && (
            <span className="bg-white/20 rounded-full px-1.5 text-xs">{anomalySummary.open}</span>
          )}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: '총 급여', value: fmt(Number(run.totalGross ?? 0)), icon: <DollarSign className="h-4 w-4 text-[#059669]" /> },
          { label: '인원', value: `${run.headcount ?? 0}명`, icon: <Users className="h-4 w-4 text-[#4338CA]" /> },
          { label: '이상 항목', value: `${anomalySummary?.open ?? 0}건`, icon: <AlertTriangle className="h-4 w-4 text-[#F59E0B]" />, highlight: (anomalySummary?.open ?? 0) > 0 },
          { label: '수동 조정', value: `${run.adjustmentCount ?? 0}건`, icon: <Clock className="h-4 w-4 text-[#999]" /> },
        ].map((kpi) => (
          <div key={kpi.label} className={`bg-white rounded-xl border p-5 ${kpi.highlight ? 'border-[#F59E0B]' : 'border-[#E8E8E8]'}`}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-[#666]">{kpi.label}</p>
              {kpi.icon}
            </div>
            <p className={`text-2xl font-bold leading-tight ${kpi.highlight ? 'text-[#F59E0B]' : 'text-[#1A1A1A]'}`}>
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* Alert Banner */}
      {!allResolved && anomalySummary && anomalySummary.open > 0 && (
        <div className="bg-[#FEF3C7] border border-[#FCD34D] rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-[#F59E0B] flex-shrink-0" />
          <p className="text-sm text-[#B45309] font-medium">
            이상 항목 {anomalySummary.open}건 — 모두 처리해야 승인 요청이 가능합니다.
            {anomalySummary.bySeverity.CRITICAL > 0 && (
              <span className="ml-2 text-[#B91C1C]">위험 {anomalySummary.bySeverity.CRITICAL}건 포함</span>
            )}
          </p>
        </div>
      )}

      {allResolved && (
        <div className="bg-[#D1FAE5] border border-[#A7F3D0] rounded-xl p-4 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-[#059669] flex-shrink-0" />
          <p className="text-sm text-[#047857] font-medium">모든 이상 항목이 처리되었습니다. 승인 요청이 가능합니다.</p>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-[#E8E8E8] flex gap-6">
        {([
          ['anomalies', `이상항목 (${anomalySummary?.open ?? 0})`],
          ['comparison', `전체직원 (${run.headcount ?? 0})`],
          ['whitelist', `예외목록 (${whitelistEntries.length})`],
        ] as const).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-2.5 text-sm font-${activeTab === tab ? 'bold border-b-2 border-[#1A1A1A] text-[#1A1A1A]' : 'medium text-[#999] hover:text-[#333]'} transition-colors`}
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
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FEE2E2] text-[#B91C1C] border border-[#FECACA]">
                    <AlertTriangle className="h-3 w-3" /> 위험 {anomalySummary.bySeverity.CRITICAL}
                  </span>
                )}
                {anomalySummary.bySeverity.WARNING > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FEF3C7] text-[#B45309] border border-[#FCD34D]">
                    <AlertTriangle className="h-3 w-3" /> 경고 {anomalySummary.bySeverity.WARNING}
                  </span>
                )}
                {anomalySummary.bySeverity.INFO > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#DBEAFE] text-[#1D4ED8] border border-[#BFDBFE]">
                    <AlertCircle className="h-3 w-3" /> 정보 {anomalySummary.bySeverity.INFO}
                  </span>
                )}
              </div>
              {infoCount > 0 && (
                <button
                  onClick={handleBulkResolveInfo}
                  disabled={bulkResolving}
                  className="text-xs px-3 py-1.5 rounded-lg border border-[#D4D4D4] text-[#555] hover:bg-[#F5F5F5] disabled:opacity-50"
                >
                  정보 항목 {infoCount}건 일괄 확인
                </button>
              )}
            </div>
          )}

          {openAnomalies.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#E8E8E8] p-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-[#059669] mx-auto mb-3" />
              <p className="text-[#666] font-medium">처리할 이상 항목이 없습니다</p>
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
                { label: '증가', value: comparisonSummary.employeesIncreased, color: 'text-[#059669]', icon: <TrendingUp className="h-4 w-4 text-[#059669]" /> },
                { label: '감소', value: comparisonSummary.employeesDecreased, color: 'text-[#DC2626]', icon: <TrendingDown className="h-4 w-4 text-[#DC2626]" /> },
                { label: '동일', value: comparisonSummary.employeesUnchanged, color: 'text-[#999]', icon: <Minus className="h-4 w-4 text-[#999]" /> },
              ].map((item) => (
                <div key={item.label} className={`${CARD_STYLES.kpi} flex items-center gap-3`}>
                  {item.icon}
                  <div>
                    <p className="text-xs text-[#666]">{item.label}</p>
                    <p className={`text-xl font-bold ${item.color}`}>{String(item.value)}명</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#999]" />
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder={tCommon('searchPlaceholder')}
                className="w-full pl-9 pr-3 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:border-[#00C853] focus:ring-2 focus:ring-[#00C853]/10"
              />
            </div>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm text-[#555] bg-white"
            >
              <option value="">전체 부서</option>
              {depts.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <label className="inline-flex items-center gap-2 text-sm text-[#555] cursor-pointer">
              <input
                type="checkbox"
                checked={anomalyOnly}
                onChange={(e) => setAnomalyOnly(e.target.checked)}
                className="w-4 h-4 rounded border-[#D4D4D4] text-[#00C853]"
              />
              이상항목만
            </label>

            {/* Download dropdown */}
            <div className="relative" ref={downloadRef}>
              <button
                onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#D4D4D4] text-sm text-[#555] hover:bg-[#F5F5F5]"
              >
                <Download className="h-4 w-4" />
                엑셀
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {showDownloadMenu && (
                <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-[#E8E8E8] py-1 w-44 z-10">
                  {[
                    { label: '전월 대비 비교', href: `/api/v1/payroll/${runId}/export/comparison` },
                    { label: '급여대장', href: `/api/v1/payroll/${runId}/export/ledger` },
                    { label: '인건비 전표', href: `/api/v1/payroll/${runId}/export/journal` },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={() => triggerDownload(item.href)}
                      className="w-full text-left px-4 py-2 text-sm text-[#333] hover:bg-[#F5F5F5]"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Comparison Table */}
          <div className="bg-white rounded-xl border border-[#E8E8E8] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E8E8E8]">
                  {[
                    { label: '이름', key: 'name' },
                    { label: '부서', key: null },
                    { label: '실수령액', key: 'currentNet' },
                    { label: '전월', key: null },
                    { label: '변동', key: 'diffPercent' },
                    { label: '사유', key: null },
                  ].map(({ label, key }) => (
                    <th
                      key={label}
                      onClick={key ? () => {
                        if (sortBy === key) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                        else { setSortBy(key as typeof sortBy); setSortOrder('asc') }
                      } : undefined}
                      className={`px-4 py-3 text-left text-[13px] text-[#999] font-semibold whitespace-nowrap ${key ? 'cursor-pointer hover:text-[#333]' : ''}`}
                    >
                      <span className="inline-flex items-center gap-1">
                        {label}
                        {key && sortBy === key && (sortOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr
                    key={row.employeeId}
                    onClick={() => setSelectedRow(row)}
                    className={`border-b border-[#F5F5F5] hover:bg-[#FAFAFA] cursor-pointer transition-colors ${row.hasAnomaly ? 'bg-[#FFF8F8]' : ''}`}
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        {row.hasAnomaly && <AlertTriangle className="h-3.5 w-3.5 text-[#F59E0B] flex-shrink-0" />}
                        <p className="text-sm font-medium text-[#1A1A1A]">{row.employeeName}</p>
                      </div>
                      <p className="text-xs text-[#999]">{row.employeeNo}</p>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-[#555]">{row.department}</td>
                    <td className="px-4 py-3.5 text-sm font-semibold text-[#1A1A1A] tabular-nums">
                      {row.currentNet.toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-[#999] tabular-nums">
                      {row.previousNet != null ? row.previousNet.toLocaleString() : '신규'}
                    </td>
                    <td className="px-4 py-3.5">
                      {row.previousNet != null ? (
                        <span className={`text-sm font-medium tabular-nums ${row.diffNet > 0 ? 'text-[#059669]' : row.diffNet < 0 ? 'text-[#DC2626]' : 'text-[#999]'}`}>
                          {row.diffNet > 0 && '+'}
                          {row.diffNet.toLocaleString()} ({fmtPct(row.diffPercent)})
                        </span>
                      ) : (
                        <span className="text-xs text-[#999]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-[#999] max-w-32 truncate">
                      {row.changeReason ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredRows.length === 0 && (
              <div className="py-10 text-center text-sm text-[#999]">검색 결과가 없습니다.</div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: 예외목록 ────────────────────────────────────────── */}
      {activeTab === 'whitelist' && (
        <div className="bg-white rounded-xl border border-[#E8E8E8]">
          {whitelistEntries.length === 0 ? (
            <div className="py-16 text-center">
              <ShieldCheck className="h-10 w-10 text-[#E8E8E8] mx-auto mb-3" />
              <p className="text-sm text-[#999]">등록된 예외가 없습니다</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E8E8E8]">
                  <th className={TABLE_STYLES.headerCell}>직원</th>
                  <th className={TABLE_STYLES.headerCell}>규칙</th>
                  <th className={TABLE_STYLES.headerCell}>등록 사유</th>
                  <th className={TABLE_STYLES.headerCell}>등록월</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {whitelistEntries.map((entry) => (
                  <tr key={entry.id} className={TABLE_STYLES.header}>
                    <td className="px-4 py-3.5 text-sm font-medium text-[#1A1A1A]">{entry.employee.name}</td>
                    <td className="px-4 py-3.5 text-xs font-mono text-[#555] bg-[#F5F5F5] rounded">{entry.ruleCode}</td>
                    <td className="px-4 py-3.5 text-sm text-[#555]">{entry.whitelistReason ?? '—'}</td>
                    <td className="px-4 py-3.5 text-xs text-[#999]">{entry.payrollRun?.yearMonth}</td>
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => handleRemoveWhitelist(entry.id)}
                        className="text-xs text-[#DC2626] hover:underline"
                      >
                        해제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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
            <div className="p-5 border-b border-[#E8E8E8] flex items-center justify-between">
              <h3 className="font-bold text-lg text-[#1A1A1A]">승인 요청</h3>
              <button onClick={() => setShowSubmitModal(false)} className="text-[#999] hover:text-[#333]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-[#FAFAFA] rounded-xl p-4 space-y-2 text-sm">
                {[
                  ['대상 월', run.yearMonth],
                  ['인원', `${run.headcount ?? 0}명`],
                  ['총 실수령액', fmt(Number(run.totalNet ?? 0))],
                  ['수동 조정', `${run.adjustmentCount ?? 0}건`],
                ].map(([label, value]) => (
                  <div key={label as string} className="flex justify-between">
                    <span className="text-[#666]">{label as string}</span>
                    <span className="font-semibold text-[#1A1A1A]">{value as string}</span>
                  </div>
                ))}
              </div>
              <div>
                <label className="text-sm font-medium text-[#333] mb-1 block">메모 (선택)</label>
                <textarea
                  value={submitNote}
                  onChange={(e) => setSubmitNote(e.target.value)}
                  placeholder="승인 요청 메모를 입력하세요"
                  rows={3}
                  className="w-full px-3 py-2.5 border border-[#E0E0E0] rounded-lg text-sm focus:border-[#00C853] focus:ring-2 focus:ring-[#00C853]/10 resize-none"
                />
              </div>
            </div>
            <div className="p-5 border-t border-[#E8E8E8] flex justify-end gap-2">
              <button
                onClick={() => setShowSubmitModal(false)}
                className="px-4 py-2 rounded-lg border border-[#D4D4D4] text-sm text-[#555] hover:bg-[#F5F5F5]"
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-5 py-2 rounded-lg bg-[#059669] hover:bg-[#047857] text-white text-sm font-semibold disabled:opacity-50"
              >
                {submitting ? '요청 중...' : '승인 요청 발송'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
