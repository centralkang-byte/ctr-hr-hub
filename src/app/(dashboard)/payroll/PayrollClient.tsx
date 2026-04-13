'use client'

import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'
import { toast } from '@/hooks/use-toast'

// ═══════════════════════════════════════════════════════════
// GP#3-D: 급여 통합 대시보드 — /payroll
// Pipeline 시각화 + 캘린더 + 요약 KPIs + 빠른 실행
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Wallet, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2,
  Clock, DollarSign, Loader2, Calendar, Play, LayoutGrid,
  TrendingUp, TrendingDown, Users, RefreshCw, Plus,
} from 'lucide-react'
import { apiClient } from '@/lib/api'
import PayrollPipeline, { type PipelineEntry } from '@/components/payroll/PayrollPipeline'
import PayrollCalendar from '@/components/payroll/PayrollCalendar'
import PayrollCreateDialog from '@/components/payroll/PayrollCreateDialog'
import type { SessionUser } from '@/types'
import { CARD_STYLES } from '@/lib/styles'

// ─── Types ──────────────────────────────────────────────────

interface CalendarEntry {
  companyCode: string | null
  companyName: string
  closingDeadline: string | null
  payDay: string | null
  dDayClosing: number | null
  dDayPay: number | null
  alertLevel: 'red' | 'amber' | 'normal'
  currentStep: number
  status: string
}

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

// fmt 함수는 컴포넌트 내부에서 t()를 사용하도록 이동

// ─── KPI Card ───────────────────────────────────────────────

interface KpiCardProps {
  label: string
  value: string
  sub?: string
  icon: React.ReactNode
  accent: string
  onClick?: () => void
}

function KpiCard({ label, value, sub, icon, accent, onClick }: KpiCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`${CARD_STYLES.kpi} text-left w-full ${onClick ? 'hover:shadow-md hover:border-border transition-all cursor-pointer' : 'cursor-default'}`}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className={`flex h-7 w-7 items-center justify-center rounded-full ${accent}`}>
          {icon}
        </div>
      </div>
      <p className="text-lg font-bold text-foreground leading-tight">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </button>
  )
}

// ─── Quick Action Button ─────────────────────────────────────

function QuickAction({ icon, label, sub, onClick, accent }: {
  icon: React.ReactNode; label: string; sub: string
  onClick: () => void; accent: string
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-card hover:shadow-md hover:border-border transition-all w-full"
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${accent}`}>
        {icon}
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground">{sub}</p>
      </div>
    </button>
  )
}

// ─── Main Component ──────────────────────────────────────────

interface Props {
  user: SessionUser
}

export default function PayrollDashboardClient({ user: _user }: Props) {
  const t = useTranslations('payroll')
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

  // Calendar entries shaped from pipelines
  const calendarEntries: CalendarEntry[] = (data?.pipelines ?? []).map((p) => ({
    companyCode: p.companyCode,
    companyName: p.companyName,
    closingDeadline: (p as unknown as Record<string, unknown>).closingDeadline as string | null,
    payDay: (p as unknown as Record<string, unknown>).payDay as string | null,
    dDayClosing: (p as unknown as Record<string, unknown>).dDayClosing as number | null,
    dDayPay: (p as unknown as Record<string, unknown>).dDayPay as number | null,
    alertLevel: p.alertLevel,
    currentStep: p.currentStep,
    status: p.status,
  }))

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#5E81F4] to-[#A855F7]">
            <Wallet className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em]">{t('dashboard.title')}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t('dashboard.subtitle')}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Month navigator */}
          <div className="flex items-center gap-1 bg-card border border-border rounded-xl px-2 py-1">
            <button onClick={prevMonth} className="p-1 rounded-lg hover:bg-muted text-muted-foreground motion-safe:transition-all">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-foreground px-2 min-w-24 text-center">
              {new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }).format(new Date(year, month - 1))}
            </span>
            <button onClick={nextMonth} className="p-1 rounded-lg hover:bg-muted text-muted-foreground motion-safe:transition-all">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <button onClick={fetchDashboard} className="p-2 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground motion-safe:transition-all">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary/85 text-white text-sm font-semibold motion-safe:transition-all"
          >
            <Plus className="h-4 w-4" />
            {t('dashboard.createRun')}
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
          {/* ── KPI Summary Cards ──────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              label={t('dashboard.totalNetPay')}
              value={fmt(data.summary.totalNetPay)}
              sub={data.summary.prevTotalNet > 0
                ? t('dashboard.momChange', { pct: `${data.summary.momChangePercent > 0 ? '+' : ''}${data.summary.momChangePercent}` })
                : t('dashboard.noPrevData')
              }
              icon={
                data.summary.momChangePercent > 0
                  ? <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                  : data.summary.momChangePercent < 0
                    ? <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                    : <DollarSign className="h-3.5 w-3.5 text-primary" />
              }
              accent="bg-indigo-500/15"
              onClick={() => router.push('/payroll/global')}
            />

            <KpiCard
              label={t('dashboard.completedCompanies')}
              value={t('dashboard.completedCount', { completed: data.summary.completedCompanies, total: data.summary.totalCompanies })}
              sub={t('dashboard.approvedOrPaid')}
              icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
              accent="bg-emerald-500/15"
            />

            <KpiCard
              label={t('dashboard.openAnomalies')}
              value={t('dashboard.anomalyCount', { count: data.summary.openAnomalies })}
              sub={data.summary.openAnomalies > 0 ? t('dashboard.reviewNeeded') : t('dashboard.allResolved')}
              icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
              accent="bg-amber-500/15"
              onClick={data.summary.openAnomalies > 0 ? () => router.push('/payroll/anomalies') : undefined}
            />

            <KpiCard
              label={t('dashboard.pendingApprovals')}
              value={t('dashboard.pendingCount', { pending: data.summary.pendingApprovals, alerts: data.summary.alertCount })}
              sub={t('dashboard.approvalAndDeadline')}
              icon={<Clock className="h-3.5 w-3.5 text-violet-500" />}
              accent="bg-purple-500/10"
              onClick={data.summary.pendingApprovals > 0 ? () => router.push('/my/tasks?tab=approvals') : undefined}
            />
          </div>

          {/* ── Pipeline Visualization ──────────────────────── */}
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center gap-2 mb-4">
              <LayoutGrid className="h-4 w-4 text-primary" />
              <h2 className="font-semibold text-foreground">{t('dashboard.pipelineStatus')}</h2>
              <span className="ml-1 text-xs text-muted-foreground">{t('dashboard.pipelineTip')}</span>
            </div>

            {data.pipelines.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                <Users className="h-8 w-8 mx-auto mb-2 text-border" />
                {t('dashboard.emptyPayroll')}
              </div>
            ) : (
              <PayrollPipeline pipelines={data.pipelines} />
            )}
          </div>

          {/* ── Payroll Calendar ────────────────────────────── */}
          <div className="bg-card rounded-xl border border-border p-5">
            <PayrollCalendar
              entries={calendarEntries}
              yearMonth={`${year}-${String(month).padStart(2, '0')}`}
            />
          </div>

          {/* ── Quick Actions ───────────────────────────────── */}
          <div>
            <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Play className="h-4 w-4 text-primary" />
              {t('dashboard.quickActions')}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <QuickAction
                icon={<Calendar className="h-5 w-5 text-primary/90" />}
                label={t('dashboard.closeAttendance')}
                sub="STEP 1 → 2"
                onClick={() => router.push('/payroll/close-attendance')}
                accent="bg-indigo-500/15"
              />
              <QuickAction
                icon={<AlertTriangle className="h-5 w-5 text-amber-500" />}
                label={t('dashboard.anomalyReview')}
                sub="STEP 3"
                onClick={() => router.push('/payroll/anomalies')}
                accent="bg-amber-500/15"
              />
              <QuickAction
                icon={<CheckCircle2 className="h-5 w-5 text-primary" />}
                label={t('dashboard.pendingApproval')}
                sub="STEP 4"
                onClick={() => router.push('/my/tasks?tab=approvals')}
                accent="bg-indigo-500/15"
              />
              <QuickAction
                icon={<Wallet className="h-5 w-5 text-emerald-600" />}
                label={t('dashboard.manualAdjust')}
                sub="STEP 2.5"
                onClick={() => router.push('/payroll/adjustments')}
                accent="bg-emerald-500/15"
              />
            </div>
          </div>
        </>
      )}

      {/* ── Create Dialog ───────────────────────────────────── */}
      <PayrollCreateDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={() => { setShowCreate(false); void fetchDashboard() }}
      />
    </div>
  )
}
