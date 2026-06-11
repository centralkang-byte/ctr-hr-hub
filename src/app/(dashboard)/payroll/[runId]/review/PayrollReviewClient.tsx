'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Payroll Anomaly Review Client (GP#3-B · Wave 1 프로토 정합)
// 3-탭 이상검토 페이지: 이상항목 / 전체직원 비교 / 예외목록
// ═══════════════════════════════════════════════════════════

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  AlertTriangle, CheckCircle2, ShieldX, ShieldCheck,
  Download, ChevronDown, ChevronUp, ArrowLeft,
  Search, Users, DollarSign, AlertCircle, Clock, Loader2,
  FileQuestion,
  type LucideIcon,
} from 'lucide-react'
import { Badge, type BadgeVariant } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/ui/EmptyState'
import { DetailPanel } from '@/components/shared/DetailPanel'
import { KpiCardsSkeleton, TableSkeleton } from '@/components/shared/PageSkeleton'
import { WdDrawer, WdField } from '@/components/shared/WdDrawer'
import { WdStatStrip } from '@/components/shared/WdStatStrip'
import { WdStatusChips } from '@/components/shared/WdStatusChips'
import { apiClient } from '@/lib/api'
import { AppError } from '@/lib/errors'
import { TABLE_STYLES, TYPOGRAPHY, BUTTON_VARIANTS } from '@/lib/styles'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import { extractPrimaryAssignment } from '@/lib/employee/extract-primary-assignment'
import type { SessionUser } from '@/types'

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
  companyId: string
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

type TabKey = 'anomalies' | 'comparison' | 'whitelist'

// ─── Constants ──────────────────────────────────────────

// 심각도 = 아이콘 틴트 + Badge variant (좌측 색 보더 카드는 금지 패턴 — rules/design.md)
const SEVERITY_CONFIG: Record<
  Anomaly['severity'],
  { icon: LucideIcon; iconClass: string; badge: BadgeVariant; labelKey: 'reviewPage.severityError' | 'reviewPage.severityWarning' | 'reviewPage.severityInfo' }
> = {
  CRITICAL: {
    icon: AlertTriangle,
    iconClass: 'text-destructive',
    badge: 'error',
    labelKey: 'reviewPage.severityError',
  },
  WARNING: {
    icon: AlertTriangle,
    iconClass: 'text-wd-orange',
    badge: 'warning',
    labelKey: 'reviewPage.severityWarning',
  },
  INFO: {
    icon: AlertCircle,
    iconClass: 'text-info',
    badge: 'info',
    labelKey: 'reviewPage.severityInfo',
  },
}

// ─── Helpers ────────────────────────────────────────────

const fmtPct = (n: number) => {
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(1)}%`
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
  const SeverityIcon = cfg.icon
  const [loading, setLoading] = useState(false)
  const [showWhitelistDrawer, setShowWhitelistDrawer] = useState(false)
  const [whitelistNote, setWhitelistNote] = useState('')
  const router = useRouter()

  // 드로어 열릴 때 폼 리셋 (WdDrawer 보존 레시피 ④)
  useEffect(() => {
    if (showWhitelistDrawer) setWhitelistNote('')
  }, [showWhitelistDrawer])

  // 성공 여부 반환 — 실패 시 드로어/입력을 유지하기 위함 (Codex G1 #4). API 시그니처 무변경.
  const resolve = async (
    resolution: 'CONFIRMED_NORMAL' | 'CORRECTED' | 'WHITELISTED',
    note?: string,
  ): Promise<boolean> => {
    if (loading) return false
    setLoading(true)
    try {
      await apiClient.put(`/api/v1/payroll/${runId}/anomalies/${anomaly.id}/resolve`, { resolution, note })
      onResolved()
      return true
    } catch (err) {
      toast({ title: t('reviewPage.anomalyFailed'), description: err instanceof Error ? err.message : '', variant: 'destructive' })
      return false
    } finally {
      setLoading(false)
    }
  }

  const handleWhitelistSubmit = async () => {
    if (loading) return
    const ok = await resolve('WHITELISTED', whitelistNote)
    if (ok) setShowWhitelistDrawer(false) // 성공 시에만 닫기 — 실패 시 입력 보존
  }

  const primary = extractPrimaryAssignment(anomaly.employee.assignments ?? [])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dept = (primary as any)?.department?.name ?? '—'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pos = (primary as any)?.position?.titleKo ?? ''

  if (anomaly.status !== 'OPEN') return null

  return (
    <>
      <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <SeverityIcon className={cn('h-4 w-4 mt-0.5 shrink-0', cfg.iconClass)} strokeWidth={1.5} aria-hidden="true" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-foreground text-sm">
                  {anomaly.employee.name}
                </span>
                <span className="text-xs text-muted-foreground">{dept}{pos ? ` / ${pos}` : ''}</span>
                <Badge variant={cfg.badge}>{t(cfg.labelKey)}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{anomaly.description}</p>
            </div>
          </div>
        </div>

        {(anomaly.currentValue || anomaly.previousValue) && (
          <div className="flex items-center gap-6 text-xs text-muted-foreground bg-muted rounded-lg p-3">
            {anomaly.currentValue != null && (
              <span>{t('reviewPage.thisMonth')} <strong className="text-foreground tabular-nums">{Number(anomaly.currentValue).toLocaleString()}</strong></span>
            )}
            {anomaly.previousValue != null && (
              <span>{t('reviewPage.prevMonth')} <strong className="text-foreground tabular-nums">{Number(anomaly.previousValue).toLocaleString()}</strong></span>
            )}
            {anomaly.threshold && (
              <span>{t('reviewPage.threshold')} <strong className="text-ctr-warning">{anomaly.threshold}</strong></span>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 pt-1 flex-wrap">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void resolve('CONFIRMED_NORMAL')}
            disabled={loading}
            className="bg-tertiary/10 text-[#006b39] hover:bg-tertiary/20 hover:text-[#006b39]"
          >
            <CheckCircle2 aria-hidden="true" />
            {t('reviewPage.confirmNormal')}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => router.push(`/payroll/adjustments`)}>
            {t('reviewPage.editLink')}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setShowWhitelistDrawer(true)}>
            <ShieldX aria-hidden="true" />
            {t('reviewPage.addException')}
          </Button>
        </div>
      </div>

      {/* 예외(화이트리스트) 등록 — 단일 단계 입력 폼 = WdDrawer (DESIGN.md §5.4) */}
      <WdDrawer
        open={showWhitelistDrawer}
        onClose={() => setShowWhitelistDrawer(false)}
        closeDisabled={loading}
        eyebrow={t('dashboard.title')}
        title={t('reviewPage.exceptionTitle')}
        secondary={{ label: tCommon('cancel'), onClick: () => setShowWhitelistDrawer(false), disabled: loading }}
        primary={{
          label: t('reviewPage.addException'),
          onClick: () => { void handleWhitelistSubmit() },
          disabled: loading,
          icon: loading
            ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            : <ShieldCheck className="h-4 w-4" aria-hidden="true" />,
        }}
      >
        <p className="text-[12.5px] text-muted-foreground">
          {t('reviewPage.exceptionDesc', { name: anomaly.employee.name, rule: anomaly.ruleCode })}
        </p>
        {/* Enter 제출 보존 — foot 버튼이 form 밖이라 hidden submit 필요 */}
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => { e.preventDefault(); void handleWhitelistSubmit() }}
        >
          <WdField label={t('reviewPage.exceptionReasonLabel')} htmlFor="payroll-review-whitelist-note">
            <textarea
              id="payroll-review-whitelist-note"
              value={whitelistNote}
              onChange={(e) => setWhitelistNote(e.target.value)}
              placeholder={tCommon('placeholderExceptionReason')}
              rows={3}
              className="w-full px-3 py-2.5 border border-border-strong rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 resize-none"
            />
          </WdField>
          <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
        </form>
      </WdDrawer>
    </>
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
  const [activeTab, setActiveTab] = useState<TabKey>('anomalies')
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

  // run 로드 실패 구분: 404(notFound/접근불가 — no-oracle 동일 응답) vs 그 외(일시 오류 → 재시도)
  const [runLoadError, setRunLoadError] = useState<'notFound' | 'error' | null>(null)

  const fetchRun = useCallback(async () => {
    try {
      const res = await apiClient.get<PayrollRunInfo>(`/api/v1/payroll/runs/${runId}`)
      setRun(res.data)
      setRunLoadError(null)
    } catch (err) {
      if (err instanceof AppError && err.statusCode === 404) {
        setRunLoadError('notFound')
      } else {
        setRunLoadError('error')
        toast({ title: t('reviewPage.loadRunFailed'), description: err instanceof Error ? err.message : '', variant: 'destructive' })
      }
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
    // whitelist 라우트는 companyId 파라미터를 받음 — run.id(runId) 오전달 시 SUPER 뷰에서 항상 빈 목록
    if (!run?.companyId) return
    try {
      const res = await apiClient.get<{ items: WhitelistEntry[] }>(
        `/api/v1/payroll/whitelist`, { companyId: run.companyId }
      )
      setWhitelistEntries(res.data.items ?? [])
    } catch (err) {
      toast({ title: t('reviewPage.loadWhitelistFailed'), description: err instanceof Error ? err.message : '', variant: 'destructive' })
    }
  }, [run?.companyId])

  const loadInitial = useCallback(async () => {
    setLoading(true)
    await fetchRun()
    await fetchAnomalies()
    setLoading(false)
  }, [fetchRun, fetchAnomalies])

  useEffect(() => {
    void loadInitial()
  }, [loadInitial])

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
  const openCount = anomalySummary?.open ?? 0

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <KpiCardsSkeleton />
        <TableSkeleton rows={6} />
      </div>
    )
  }

  // 명시적 not-found/오류 상태 — 무한 스켈레톤 금지 (rules/components.md 3-상태)
  if (!run) {
    const isNotFound = runLoadError === 'notFound'
    return (
      <div className="p-4">
        <EmptyState
          icon={isNotFound ? FileQuestion : AlertCircle}
          title={isNotFound ? t('runLoad.notFoundTitle') : t('runLoad.errorTitle')}
          sub={isNotFound ? t('runLoad.notFoundSub') : t('runLoad.errorSub')}
          action={isNotFound
            ? { label: t('runLoad.backToHub'), onClick: () => router.push('/payroll') }
            : { label: tCommon('retry'), onClick: () => void loadInitial() }}
          size="lg"
          standalone
        />
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={tCommon('back')}
            onClick={() => router.push('/payroll')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className={TYPOGRAPHY.pageTitle}>{run.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[13px] text-muted-foreground">{run.yearMonth}</span>
              <Badge variant="info">{t('reviewPage.statusReviewing')}</Badge>
            </div>
          </div>
        </div>

        {/* Submit Button — disabled 시에도 사유 툴팁 노출(래퍼 span title) */}
        <span title={!allResolved ? t('reviewPage.submitTooltip', { count: openCount }) : t('reviewPage.approvalRequest')}>
          <Button type="button" onClick={() => setShowSubmitModal(true)} disabled={!allResolved}>
            <CheckCircle2 aria-hidden="true" />
            {t('reviewPage.approvalRequest')}
            {!allResolved && anomalySummary && (
              <span className="bg-white/20 rounded-full px-1.5 text-xs tabular-nums">{anomalySummary.open}</span>
            )}
          </Button>
        </span>
      </div>

      {/* KPI Strip (DESIGN_RULES §3 패턴 A) */}
      <WdStatStrip
        items={[
          {
            label: t('reviewPage.totalGross'),
            value: fmt(Number(run.totalGross ?? 0)),
            icon: DollarSign,
            tone: 'success',
          },
          {
            label: t('reviewPage.headcount'),
            value: t('reviewPage.summaryHeadcount', { count: run.headcount ?? 0 }),
            icon: Users,
            tone: 'info',
          },
          {
            label: t('reviewPage.anomalyItems'),
            value: t('reviewPage.summaryAdjustments', { count: openCount }),
            icon: AlertTriangle,
            tone: openCount > 0 ? 'warning' : 'default',
            foot: openCount > 0 ? t('reviewPage.anomalyFoot') : undefined,
            onClick: openCount > 0 ? () => setActiveTab('anomalies') : undefined,
          },
          {
            label: t('adjustments'),
            value: t('reviewPage.summaryAdjustments', { count: run.adjustmentCount ?? 0 }),
            icon: Clock,
          },
        ]}
      />

      {/* Alert Banner (D17 bg/text 분리) */}
      {!allResolved && anomalySummary && anomalySummary.open > 0 && (
        <div className="bg-warning-bright/15 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-wd-orange flex-shrink-0" aria-hidden="true" />
          <p className="text-sm text-ctr-warning font-medium">
            {t('reviewPage.alertBanner', { count: anomalySummary.open })}
            {anomalySummary.bySeverity.CRITICAL > 0 && (
              <span className="ml-2 text-destructive">{t('reviewPage.alertCritical', { count: anomalySummary.bySeverity.CRITICAL })}</span>
            )}
          </p>
        </div>
      )}

      {allResolved && (
        <div className="bg-tertiary/10 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-tertiary flex-shrink-0" aria-hidden="true" />
          <p className="text-sm text-[#006b39] font-medium">{t('reviewPage.allResolvedBanner')}</p>
        </div>
      )}

      {/* Tabs — Radix Segmented Control (lazy fetch는 activeTab useEffect가 담당) */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
        <TabsList aria-label={t('reviewPage.tabsAria')}>
          <TabsTrigger value="anomalies">{t('reviewPage.anomaliesTab', { count: openCount })}</TabsTrigger>
          <TabsTrigger value="comparison">{t('reviewPage.comparisonTab', { count: run.headcount ?? 0 })}</TabsTrigger>
          <TabsTrigger value="whitelist">{t('reviewPage.whitelistTab', { count: whitelistEntries.length })}</TabsTrigger>
        </TabsList>

        {/* ── Tab: 이상항목 ───────────────────────────────────── */}
        <TabsContent value="anomalies" className="mt-4">
          <div className="space-y-4">
            {anomalySummary && anomalySummary.total > 0 && (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  {anomalySummary.bySeverity.CRITICAL > 0 && (
                    <Badge variant="error" className="gap-1">
                      <AlertTriangle className="h-3 w-3" aria-hidden="true" /> {t('reviewPage.critical', { count: anomalySummary.bySeverity.CRITICAL })}
                    </Badge>
                  )}
                  {anomalySummary.bySeverity.WARNING > 0 && (
                    <Badge variant="warning" className="gap-1">
                      <AlertTriangle className="h-3 w-3" aria-hidden="true" /> {t('reviewPage.warning', { count: anomalySummary.bySeverity.WARNING })}
                    </Badge>
                  )}
                  {anomalySummary.bySeverity.INFO > 0 && (
                    <Badge variant="info" className="gap-1">
                      <AlertCircle className="h-3 w-3" aria-hidden="true" /> {t('reviewPage.info', { count: anomalySummary.bySeverity.INFO })}
                    </Badge>
                  )}
                </div>
                {infoCount > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void handleBulkResolveInfo()}
                    disabled={bulkResolving}
                  >
                    {t('reviewPage.bulkConfirmInfo', { count: infoCount })}
                  </Button>
                )}
              </div>
            )}

            {openAnomalies.length === 0 ? (
              <EmptyState icon={CheckCircle2} title={t('reviewPage.emptyAnomalies')} size="lg" standalone />
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
        </TabsContent>

        {/* ── Tab: 전체직원 (비교표) ──────────────────────────── */}
        <TabsContent value="comparison" className="mt-4">
          <div className="space-y-4">
            {/* Comparison summary chips (DESIGN_RULES §3 패턴 B) */}
            {comparisonSummary && (
              <WdStatusChips
                aria-label={t('reviewPage.comparisonChipsAria')}
                items={[
                  {
                    label: t('reviewPage.increased'),
                    value: t('reviewPage.summaryHeadcount', { count: Number(comparisonSummary.employeesIncreased ?? 0) }),
                    tone: 'success',
                    muted: Number(comparisonSummary.employeesIncreased ?? 0) === 0,
                  },
                  {
                    label: t('reviewPage.decreased'),
                    value: t('reviewPage.summaryHeadcount', { count: Number(comparisonSummary.employeesDecreased ?? 0) }),
                    tone: 'danger',
                    muted: Number(comparisonSummary.employeesDecreased ?? 0) === 0,
                  },
                  {
                    label: t('reviewPage.unchanged'),
                    value: t('reviewPage.summaryHeadcount', { count: Number(comparisonSummary.employeesUnchanged ?? 0) }),
                    tone: 'default',
                  },
                ]}
              />
            )}

            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <input
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder={tCommon('searchPlaceholder')}
                  className="w-full pl-9 pr-3 py-2 border border-border-strong rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </div>
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="px-3 py-2 border border-border-strong rounded-lg text-sm text-muted-foreground bg-card"
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
                {t('reviewPage.anomalyOnly')}
              </label>

              {/* Download dropdown */}
              <div className="relative" ref={downloadRef}>
                <Button type="button" variant="outline" onClick={() => setShowDownloadMenu(!showDownloadMenu)}>
                  <Download aria-hidden="true" />
                  {t('reviewPage.excel')}
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
                {showDownloadMenu && (
                  <div className="absolute right-0 top-full mt-1 bg-card rounded-xl shadow-md border border-border py-1 w-44 z-10">
                    {[
                      { label: t('reviewPage.exportComparison'), href: `/api/v1/payroll/${runId}/export/comparison` },
                      { label: t('reviewPage.exportLedger'), href: `/api/v1/payroll/${runId}/export/ledger` },
                      { label: t('reviewPage.exportJournal'), href: `/api/v1/payroll/${runId}/export/journal` },
                    ].map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => triggerDownload(item.href)}
                        className={cn(BUTTON_VARIANTS.ghost, 'w-full text-left px-4 py-2 text-sm')}
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
                      { label: t('reviewPage.netPayLabel'), key: 'currentNet', align: 'right' },
                      { label: t('reviewPage.colPrevMonth'), key: null, align: 'right' },
                      { label: t('reviewPage.changeRate'), key: 'diffPercent', align: 'right' },
                      { label: t('reviewPage.colReason'), key: null, align: 'left' },
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
                      <td colSpan={6} className="py-10 text-center text-sm text-muted-foreground">{t('reviewPage.noSearchResults')}</td>
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
                            {row.hasAnomaly && <AlertTriangle className="h-3.5 w-3.5 text-wd-orange flex-shrink-0" aria-hidden="true" />}
                            <p className="font-medium">{row.employeeName}</p>
                          </div>
                          <p className="text-xs text-muted-foreground">{row.employeeNo}</p>
                        </td>
                        <td className={TABLE_STYLES.cellMuted}>{row.department}</td>
                        <td className={cn(TABLE_STYLES.cellRight, "font-semibold tabular-nums")}>
                          {row.currentNet.toLocaleString()}
                        </td>
                        <td className={cn(TABLE_STYLES.cellRight, "text-muted-foreground tabular-nums")}>
                          {row.previousNet != null ? row.previousNet.toLocaleString() : t('reviewPage.newEmployee')}
                        </td>
                        <td className={TABLE_STYLES.cellRight}>
                          {row.previousNet != null ? (
                            <span className={cn("font-medium tabular-nums", row.diffNet > 0 ? 'text-[#006b39]' : row.diffNet < 0 ? 'text-destructive' : 'text-muted-foreground')}>
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
        </TabsContent>

        {/* ── Tab: 예외목록 ────────────────────────────────────── */}
        <TabsContent value="whitelist" className="mt-4">
          <div className={TABLE_STYLES.wrapper}>
            <table className={TABLE_STYLES.table}>
              <thead>
                <tr className={TABLE_STYLES.header}>
                  <th className={TABLE_STYLES.headerCell}>{t('reviewPage.colEmployee')}</th>
                  <th className={TABLE_STYLES.headerCell}>{t('reviewPage.colRule')}</th>
                  <th className={TABLE_STYLES.headerCell}>{t('reviewPage.colWhitelistReason')}</th>
                  <th className={TABLE_STYLES.headerCell}>{t('reviewPage.colRegisteredMonth')}</th>
                  <th className={TABLE_STYLES.headerCell} />
                </tr>
              </thead>
              <tbody>
                {whitelistEntries.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <EmptyState icon={ShieldCheck} title={t('reviewPage.emptyWhitelist')} />
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
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleRemoveWhitelist(entry.id)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/5"
                        >
                          {t('reviewPage.removeWhitelist')}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Employee Detail Panel (조회 전용 — DESIGN.md §5.4 Inspector) ── */}
      <DetailPanel
        open={selectedRow != null}
        onClose={() => setSelectedRow(null)}
        title={selectedRow?.employeeName ?? ''}
        subtitle={selectedRow?.department}
      >
        {selectedRow && (
          <div className="p-4 space-y-3">
            {([
              [t('reviewPage.currentNetPay'), selectedRow.currentNet],
              [t('basePay'), selectedRow.currentBaseSalary],
              [t('reviewPage.prevNetPay'), selectedRow.previousNet ?? '—'],
            ] as [string, number | string][]).map(([label, value]) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium text-foreground tabular-nums">
                  {typeof value === 'number' ? t('fmt.amountWon', { n: value.toLocaleString() }) : String(value)}
                </span>
              </div>
            ))}
            {selectedRow.diffNet !== 0 && (
              <div className="flex justify-between text-sm font-semibold">
                <span className="text-muted-foreground">{t('reviewPage.changeRate')}</span>
                <span className={cn('tabular-nums', selectedRow.diffNet > 0 ? 'text-[#006b39]' : 'text-destructive')}>
                  {t('reviewPage.changeAmount', { amount: `${selectedRow.diffNet > 0 ? '+' : ''}${selectedRow.diffNet.toLocaleString()}`, pct: fmtPct(selectedRow.diffPercent) })}
                </span>
              </div>
            )}
            {selectedRow.changeReason && (
              <div className="text-xs text-muted-foreground bg-muted rounded-lg p-2 mt-2">
                {t('reviewPage.reason', { reason: selectedRow.changeReason })}
              </div>
            )}
          </div>
        )}
      </DetailPanel>

      {/* ── Submit for Approval Dialog (confirm류 — 중앙 Dialog 유지) ── */}
      <Dialog open={showSubmitModal} onOpenChange={(o) => { if (!o && !submitting) setShowSubmitModal(false) }}>
        <DialogContent className="max-w-lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t('reviewPage.approvalConfirmTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted rounded-xl p-4 space-y-2 text-sm">
              {([
                [t('reviewPage.summaryMonth'), run.yearMonth],
                [t('reviewPage.headcount'), t('reviewPage.summaryHeadcount', { count: run.headcount ?? 0 })],
                [t('netPay'), fmt(Number(run.totalNet ?? 0))],
                [t('adjustments'), t('reviewPage.summaryAdjustments', { count: run.adjustmentCount ?? 0 })],
              ] as [string, string][]).map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-semibold text-foreground tabular-nums">{value}</span>
                </div>
              ))}
            </div>
            <div>
              <label htmlFor="payroll-review-submit-note" className="text-sm font-medium text-foreground mb-1 block">
                {t('reviewPage.memoOptional')}
              </label>
              <textarea
                id="payroll-review-submit-note"
                value={submitNote}
                onChange={(e) => setSubmitNote(e.target.value)}
                placeholder={tCommon('placeholderApprovalMemo')}
                rows={3}
                className="w-full px-3 py-2.5 border border-border-strong rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowSubmitModal(false)} disabled={submitting}>
              {tCommon('cancel')}
            </Button>
            <Button type="button" onClick={() => void handleSubmit()} disabled={submitting}>
              {submitting && <Loader2 className="animate-spin" aria-hidden="true" />}
              {submitting ? t('reviewPage.requesting') : t('reviewPage.approvalRequestSend')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
