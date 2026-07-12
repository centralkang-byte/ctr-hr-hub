'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 급여 통합 대시보드 (/payroll)
// Wave 1: 프로토 PayrollMgmtPage 정합 — page-h 골격 + wd-stat-strip
// + 파이프라인 셀 그리드 + 빠른 실행 6종 + 일정 테이블.
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import {
  Wallet, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2,
  Clock, Loader2, Calendar, LayoutGrid, Inbox, Sparkles, FileText,
  RefreshCw, Plus, Users, ArrowRight,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { apiClient } from '@/lib/api'
import { cn } from '@/lib/utils'
import PayrollPipeline, { type PipelineEntry } from '@/components/payroll/PayrollPipeline'
import PayrollCalendar from '@/components/payroll/PayrollCalendar'
import PayrollCreateDrawer from '@/components/payroll/PayrollCreateDrawer'
import { WdStatStrip } from '@/components/shared/WdStatStrip'
import type { SessionUser } from '@/types'
import { TYPOGRAPHY, BUTTON_VARIANTS, BUTTON_SIZES } from '@/lib/styles'

// ─── Types ──────────────────────────────────────────────────

interface DashboardData {
  pipelines: PipelineEntry[]
  summary: {
    yearMonth: string
    year: number
    month: number
    totalNetPay: number
    prevTotalNet: number
    momChangePercent: number
    openAnomalies: number
    pendingApprovals: number
    alertCount: number
    totalCompanies: number
    completedCompanies: number
  }
}

// ─── Quick Action Row (proto: 가로형 행 버튼 — 아이콘 사각 + 라벨 + mono sub + 화살표) ───

interface QuickActionRowProps {
  icon: LucideIcon
  label: string
  sub: string
  iconClass: string
  onClick: () => void
  disabled?: boolean
}

function QuickActionRow({ icon: Icon, label, sub, iconClass, onClick, disabled }: QuickActionRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 text-left',
        'transition-all hover:border-border-strong hover:shadow-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        disabled && 'cursor-not-allowed opacity-60 hover:border-border hover:shadow-none',
      )}
    >
      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]', iconClass)}>
        <Icon className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-semibold text-foreground">{label}</span>
        <span className="block truncate font-mono text-[11px] tabular-nums text-muted-foreground">{sub}</span>
      </span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" aria-hidden="true" />
    </button>
  )
}

// ─── Main Component ──────────────────────────────────────────

interface Props {
  user: SessionUser
}

export default function PayrollDashboardClient({ user: _user }: Props) {
  const t = useTranslations('payroll')
  const tc = useTranslations('common')
  const locale = useLocale()
  const router = useRouter()
  const now = new Date()

  // 금액 포매팅 (i18n)
  const fmt = (n: number) => {
    if (n >= 1_0000_0000) return t('fmt.amountEok', { n: (n / 1_0000_0000).toFixed(1) })
    if (n >= 1_0000) return t('fmt.amountMan', { n: (n / 1_0000).toFixed(0) })
    return t('fmt.amountWon', { n: n.toLocaleString() })
  }

  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  const fetchDashboard = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<DashboardData>(`/api/v1/payroll/dashboard?year=${year}&month=${month}`)
      setData(res.data)
    } catch (err) {
      toast({ title: t('dashboard.loadFailed'), description: err instanceof Error ? err.message : '', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => { void fetchDashboard() }, [fetchDashboard])

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  const selectedYearMonth = `${year}-${String(month).padStart(2, '0')}`

  // 명세서 배포 타깃 — 선택 월의 배포 가능 run이 정확히 1개일 때만 직접 이동
  const publishables = useMemo(
    () => (data?.pipelines ?? []).filter(
      (p) => p.payrollRunId && (p.status === 'APPROVED' || p.status === 'PAID'),
    ),
    [data],
  )
  const publishTargetRunId = publishables.length === 1 ? publishables[0].payrollRunId : null

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4">

      {/* ── Header (proto .page-h) ───────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className={TYPOGRAPHY.pageTitle}>{t('dashboard.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('dashboard.subtitle')}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Month navigator (proto .seg) */}
          <div className="inline-flex items-stretch overflow-hidden rounded-lg border border-border-strong bg-card">
            <button
              type="button"
              onClick={prevMonth}
              aria-label={t('dashboard.prevMonth')}
              className="px-2 py-1.5 text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <span className="flex min-w-[110px] items-center justify-center border-x border-border-strong px-3 text-sm font-semibold tabular-nums text-foreground">
              {new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }).format(new Date(year, month - 1))}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              aria-label={t('dashboard.nextMonth')}
              className="px-2 py-1.5 text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => void fetchDashboard()}
            aria-label={tc('refresh')}
            className={cn(BUTTON_VARIANTS.ghost, 'rounded-lg p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring')}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} aria-hidden="true" />
          </button>

          {/* 주 액션 — 마지막 배치 (proto) */}
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className={cn(BUTTON_VARIANTS.primary, BUTTON_SIZES.md, 'inline-flex items-center gap-1.5 font-semibold')}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t('dashboard.newCycle')}
          </button>
        </div>
      </div>

      {/* ── Loading ─────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {!loading && data && (
        <>
          {/* ── KPI (proto .wd-stat-strip) ───────────────────── */}
          <WdStatStrip
            items={[
              {
                label: t('dashboard.totalNetPay'),
                value: fmt(data.summary.totalNetPay),
                icon: Wallet,
                // 이번 달 사이클 미시작(합계 0)이면 "-100%"가 노이즈라 전월 대비 대신 미시작 안내
                foot: data.summary.totalNetPay <= 0
                  ? t('dashboard.cycleNotStarted')
                  : data.summary.prevTotalNet > 0
                  ? (
                    <span className={data.summary.momChangePercent >= 0 ? 'font-semibold text-[#006b39]' : 'font-semibold text-destructive'}>
                      {t('dashboard.momChange', { pct: `${data.summary.momChangePercent > 0 ? '+' : ''}${data.summary.momChangePercent}` })}
                    </span>
                  )
                  : t('dashboard.noPrevData'),
                onClick: () => router.push('/payroll/global'),
              },
              {
                label: t('dashboard.completedCompanies'),
                value: t('dashboard.completedCount', { completed: data.summary.completedCompanies, total: data.summary.totalCompanies }),
                icon: CheckCircle2,
                tone: 'success',
                foot: t('dashboard.approvedOrPaid'),
              },
              {
                label: t('dashboard.openAnomalies'),
                value: t('dashboard.anomalyCount', { count: data.summary.openAnomalies }),
                icon: AlertTriangle,
                tone: data.summary.openAnomalies > 0 ? 'danger' : 'default',
                foot: data.summary.openAnomalies > 0 ? t('dashboard.reviewNeeded') : t('dashboard.allResolved'),
                onClick: data.summary.openAnomalies > 0 ? () => router.push('/payroll/anomalies') : undefined,
              },
              {
                label: t('dashboard.pendingApprovals'),
                value: t('dashboard.pendingCount', { pending: data.summary.pendingApprovals, alerts: data.summary.alertCount }),
                icon: Clock,
                tone: data.summary.pendingApprovals > 0 || data.summary.alertCount > 0 ? 'warning' : 'default',
                foot: t('dashboard.approvalAndDeadline'),
                onClick: data.summary.pendingApprovals > 0 ? () => router.push('/my/tasks?tab=approvals') : undefined,
              },
            ]}
          />

          {/* ── Pipeline (proto 셀 그리드 카드) ───────────────── */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-4 flex flex-wrap items-baseline gap-2">
              <LayoutGrid className="h-4 w-4 self-center text-primary" aria-hidden="true" />
              <h2 className={TYPOGRAPHY.cardTitle}>{t('dashboard.pipelineStatus')}</h2>
              <span className="text-xs text-muted-foreground">{t('dashboard.pipelineTip')}</span>
            </div>

            {data.pipelines.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <Users className="mx-auto mb-2 h-8 w-8 text-border" aria-hidden="true" />
                {t('dashboard.emptyPayroll')}
              </div>
            ) : (
              <PayrollPipeline pipelines={data.pipelines} />
            )}
          </div>

          {/* ── Quick Actions (proto .wd-section-h + grid-3) ──── */}
          <div>
            <h2 className={cn(TYPOGRAPHY.sectionTitle, 'mb-3')}>{t('dashboard.quickActions')}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <QuickActionRow
                icon={Calendar}
                label={t('dashboard.closeAttendance')}
                sub="STEP 1 → 2"
                iconClass="bg-primary/10 text-primary"
                onClick={() => router.push('/payroll/close-attendance')}
              />
              <QuickActionRow
                icon={AlertTriangle}
                label={t('dashboard.anomalyReview')}
                sub="STEP 3"
                iconClass="bg-destructive/10 text-destructive"
                onClick={() => router.push('/payroll/anomalies')}
              />
              <QuickActionRow
                icon={Inbox}
                label={t('dashboard.pendingApproval')}
                sub="STEP 4"
                iconClass="bg-wd-orange-soft text-wd-orange-ink"
                onClick={() => router.push('/my/tasks?tab=approvals')}
              />
              <QuickActionRow
                icon={Sparkles}
                label={t('dashboard.manualAdjust')}
                sub="STEP 2.5"
                iconClass="bg-tertiary/10 text-[#006b39]"
                onClick={() => router.push('/payroll/adjustments')}
              />
              <QuickActionRow
                icon={Wallet}
                label={t('dashboard.bankTransfer')}
                sub="STEP 5"
                iconClass="bg-wt-4/10 text-wt-4"
                onClick={() => router.push('/payroll/bank-transfers')}
              />
              <QuickActionRow
                icon={FileText}
                label={t('dashboard.publishPayslips')}
                sub={publishTargetRunId
                  ? 'STEP 5'
                  : publishables.length === 0 ? t('dashboard.publishNone') : t('dashboard.publishMultiple')}
                iconClass="bg-info/10 text-info"
                disabled={!publishTargetRunId}
                onClick={() => publishTargetRunId && router.push(`/payroll/${publishTargetRunId}/publish`)}
              />
            </div>
          </div>

          {/* ── 일정 테이블 (proto Card) ─────────────────────── */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <PayrollCalendar
              entries={data.pipelines}
              yearMonth={selectedYearMonth}
            />
          </div>
        </>
      )}

      {/* ── Create Drawer ───────────────────────────────────── */}
      <PayrollCreateDrawer
        open={showCreate}
        onClose={() => setShowCreate(false)}
        defaultYearMonth={selectedYearMonth}
        onCreated={() => { setShowCreate(false); void fetchDashboard() }}
      />
    </div>
  )
}
