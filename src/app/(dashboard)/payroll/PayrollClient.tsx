'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
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

const MONTHS_KO = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']

const fmt = (n: number) => {
  if (n >= 1_0000_0000) return `${(n / 1_0000_0000).toFixed(1)}억원`
  if (n >= 1_0000) return `${(n / 1_0000).toFixed(0)}만원`
  return n.toLocaleString('ko-KR') + '원'
}

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
        <p className="text-xs text-[#666]">{label}</p>
        <div className={`flex h-7 w-7 items-center justify-center rounded-full ${accent}`}>
          {icon}
        </div>
      </div>
      <p className="text-lg font-bold text-foreground leading-tight">{value}</p>
      {sub && <p className="text-xs text-[#999] mt-0.5">{sub}</p>}
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
        <p className="text-[11px] text-[#999]">{sub}</p>
      </div>
    </button>
  )
}

// ─── Main Component ──────────────────────────────────────────

interface Props {
  user: SessionUser
}

export default function PayrollDashboardClient({ user: _user }: Props) {
  const router = useRouter()
  const now = new Date()

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
      toast({ title: '급여 대시보드 로드 실패', description: err instanceof Error ? err.message : '다시 시도해 주세요.', variant: 'destructive' })
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
            <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em]">{'급여 관리'}</h1>
            <p className="text-sm text-[#666] mt-0.5">{'전체 법인 파이프라인 현황'}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Month navigator */}
          <div className="flex items-center gap-1 bg-card border border-border rounded-xl px-2 py-1">
            <button onClick={prevMonth} className="p-1 rounded-lg hover:bg-muted text-[#555]">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-foreground px-2 min-w-24 text-center">
              {year}년 {MONTHS_KO[month - 1]}
            </span>
            <button onClick={nextMonth} className="p-1 rounded-lg hover:bg-muted text-[#555]">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <button onClick={fetchDashboard} className="p-2 rounded-xl border border-border bg-card hover:bg-muted text-[#555]">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary/85 text-white text-sm font-semibold"
          >
            <Plus className="h-4 w-4" />
            {'급여 실행 생성'}
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
              label="총 실수령액"
              value={fmt(data.summary.totalNetPay)}
              sub={data.summary.prevTotalNet > 0
                ? `전월 대비 ${data.summary.momChangePercent > 0 ? '+' : ''}${data.summary.momChangePercent}%`
                : '전월 데이터 없음'
              }
              icon={
                data.summary.momChangePercent > 0
                  ? <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                  : data.summary.momChangePercent < 0
                    ? <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                    : <DollarSign className="h-3.5 w-3.5 text-primary" />
              }
              accent="bg-indigo-100"
              onClick={() => router.push('/payroll/global')}
            />

            <KpiCard
              label="완료 법인"
              value={`${data.summary.completedCompanies} / ${data.summary.totalCompanies}개`}
              sub="승인 또는 지급 완료"
              icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
              accent="bg-emerald-100"
            />

            <KpiCard
              label="미처리 이상 항목"
              value={`${data.summary.openAnomalies}건`}
              sub={data.summary.openAnomalies > 0 ? '검토 필요' : '모두 해결됨 ✅'}
              icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
              accent="bg-amber-100"
              onClick={data.summary.openAnomalies > 0 ? () => router.push('/payroll/anomalies') : undefined}
            />

            <KpiCard
              label={`결재 대기 / 마감 임박`}
              value={`${data.summary.pendingApprovals}건 / ${data.summary.alertCount}개`}
              sub={`결재 / D-3 법인`}
              icon={<Clock className="h-3.5 w-3.5 text-violet-500" />}
              accent="bg-purple-50"
              onClick={data.summary.pendingApprovals > 0 ? () => router.push('/approvals/inbox') : undefined}
            />
          </div>

          {/* ── Pipeline Visualization ──────────────────────── */}
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center gap-2 mb-4">
              <LayoutGrid className="h-4 w-4 text-primary" />
              <h2 className="font-semibold text-foreground">{'파이프라인 현황'}</h2>
              <span className="ml-1 text-xs text-[#999]">{'— 각 배지를 클릭하면 해당 단계로 이동합니다'}</span>
            </div>

            {data.pipelines.length === 0 ? (
              <div className="py-8 text-center text-[#999] text-sm">
                <Users className="h-8 w-8 mx-auto mb-2 text-border" />
                {'이 월에 급여 실행이 없습니다. 급여 실행을 생성해 주세요.'}
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
              {'빠른 실행'}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <QuickAction
                icon={<Calendar className="h-5 w-5 text-primary/90" />}
                label="근태 마감"
                sub="STEP 1 → 2"
                onClick={() => router.push('/payroll/close-attendance')}
                accent="bg-indigo-100"
              />
              <QuickAction
                icon={<AlertTriangle className="h-5 w-5 text-amber-500" />}
                label="이상 검토"
                sub="STEP 3"
                onClick={() => router.push('/payroll/anomalies')}
                accent="bg-amber-100"
              />
              <QuickAction
                icon={<CheckCircle2 className="h-5 w-5 text-primary" />}
                label="승인 대기"
                sub="STEP 4 — 승인함으로"
                onClick={() => router.push('/approvals/inbox?module=PAYROLL')}
                accent="bg-indigo-100"
              />
              <QuickAction
                icon={<Wallet className="h-5 w-5 text-emerald-600" />}
                label="수동 조정"
                sub="STEP 2.5"
                onClick={() => router.push('/payroll/adjustments')}
                accent="bg-emerald-100"
              />
            </div>
          </div>
        </>
      )}

      {/* ── Create Dialog ───────────────────────────────────── */}
      {showCreate && (
        <PayrollCreateDialog
          onCreated={() => { setShowCreate(false); void fetchDashboard() }}
        />
      )}
    </div>
  )
}
