'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Employee Home (V3 2-Zone)
// Phase 4 Batch 7: Action Zone + Monitor Zone 전면 재구축.
// 조건부 Personal 트래커가 Action Zone 최상단에 표시된다.
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import {
  Calendar,
  CalendarDays,
  Wallet,
  LogIn,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DashboardTaskList } from './DashboardTaskList'
import { DashboardErrorBanner } from './DashboardErrorBanner'
import { OnboardingTracker } from './OnboardingTracker'
import { OffboardingTracker } from './OffboardingTracker'
import { PlaceholderCard } from './PlaceholderCard'
import { TYPOGRAPHY, BUTTON_VARIANTS } from '@/lib/styles'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { SessionUser, EmployeeSummary } from '@/types'

// ─── Types ────────────────────────────────────────────────

interface Props {
  user: SessionUser
}

// ─── Helpers ──────────────────────────────────────────────

function ActionKpiCard({
  label,
  value,
  color = 'primary',
}: {
  label: string
  value: string | number
  color?: 'primary' | 'error' | 'warning' | 'success'
}) {
  const colorMap: Record<string, string> = {
    primary: 'text-primary',
    error: 'text-error',
    warning: 'text-[#B45309]',
    success: 'text-tertiary',
  }
  return (
    <div
      aria-label={`${label}: ${value}`}
      className="rounded-lg bg-muted/50 p-4 text-center"
    >
      <p
        className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground"
        aria-hidden="true"
      >
        {label}
      </p>
      <p
        className={cn(
          'mt-1 font-display text-2xl font-extrabold tabular-nums',
          colorMap[color],
        )}
        aria-hidden="true"
      >
        {value}
      </p>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────

export function EmployeeHome({ user }: Props) {
  const t = useTranslations('home')
  const [summary, setSummary] = useState<EmployeeSummary | null>(null)
  const [error, setError] = useState(false)

  const fetchSummary = useCallback(async () => {
    setError(false)
    try {
      const res = await apiClient.get<EmployeeSummary>('/api/v1/home/summary')
      setSummary(res.data)
    } catch {
      setError(true)
      toast({ title: '로드 실패', variant: 'destructive' })
    }
  }, [])

  useEffect(() => {
    void fetchSummary()
  }, [fetchSummary])

  const annualLeave = summary?.leaveBalance?.find(
    (lb) => lb.leaveType === 'ANNUAL',
  )

  return (
    <div className="space-y-6">
      {/* ── Greeting ── */}
      <header>
        <h1 id="dashboard-title" className={TYPOGRAPHY.pageTitle}>
          {t('employee.actionTitle', { name: user.name })}
        </h1>
        <p className={`mt-1 ${TYPOGRAPHY.caption}`}>{t('employee.goodDay')}</p>
      </header>

      {/* ── Personal tracker 최상단 (조건부) ── */}
      <div
        aria-live="polite"
        className="motion-safe:transition-opacity motion-safe:duration-200"
      >
        {summary?.myOnboarding && (
          <div className="rounded-2xl bg-primary/5 p-6 shadow-lg">
            <OnboardingTracker
              variant="personal"
              personal={summary.myOnboarding}
            />
          </div>
        )}
        {summary?.myOffboarding && (
          <div className="rounded-2xl bg-error/5 p-6 shadow-lg">
            <OffboardingTracker
              variant="personal"
              personal={summary.myOffboarding}
            />
          </div>
        )}
      </div>

      {/* ── Quick Actions ── */}
      <nav
        aria-label={t('employee.quickActionsGroup')}
        className="flex flex-wrap gap-2"
      >
        <Button
          asChild
          size="sm"
          className={cn('gap-1.5', BUTTON_VARIANTS.primary)}
        >
          <Link href="/attendance" aria-label={t('employee.clockIn')}>
            <LogIn className="h-4 w-4 stroke-[1.5]" aria-hidden="true" />
            {t('employee.clockIn')}
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="gap-1.5">
          <Link href="/leave" aria-label={t('employee.leaveRequest')}>
            <CalendarDays className="h-4 w-4 stroke-[1.5]" aria-hidden="true" />
            {t('employee.leaveRequest')}
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="gap-1.5">
          <Link href="/payroll/me" aria-label={t('employee.payslip')}>
            <FileText className="h-4 w-4 stroke-[1.5]" aria-hidden="true" />
            {t('employee.payslip')}
          </Link>
        </Button>
      </nav>

      {/* ── ACTION ZONE ── */}
      <section
        aria-label={t('actionZone')}
        className="rounded-2xl bg-card p-8 shadow-sm"
      >
        <div
          className="mb-4 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground"
          aria-hidden="true"
        >
          {t('actionZone')}
        </div>

        {error && (
          <DashboardErrorBanner
            message={t('loadError')}
            onRetry={() => void fetchSummary()}
          />
        )}

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <DashboardTaskList user={user} />
          <div
            className="grid grid-cols-2 gap-3 content-start"
            role="group"
            aria-label={t('employee.actionKpiGroup')}
          >
            <ActionKpiCard
              label={t('employee.actionKpi.remainingLeave')}
              value={annualLeave ? `${annualLeave.remaining}` : '-'}
              color="primary"
            />
            <ActionKpiCard
              label={t('employee.actionKpi.workDays')}
              value={summary?.attendanceThisMonth ?? '-'}
              color="primary"
            />
            <ActionKpiCard
              label={t('employee.actionKpi.overtime')}
              value="-"
              color="warning"
            />
            <ActionKpiCard
              label={t('employee.actionKpi.training')}
              value="-"
              color="warning"
            />
          </div>
        </div>
      </section>

      {/* ── MONITOR ZONE (3 Placeholders) ── */}
      <section aria-label={t('monitorZone')} className="space-y-6">
        <div
          className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground"
          aria-hidden="true"
        >
          {t('monitorZone')}
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <PlaceholderCard
            title={t('employee.monitorSlot.attendanceHeatmap')}
            icon={Calendar}
          />
          <PlaceholderCard
            title={t('employee.monitorSlot.upcomingSchedule')}
            icon={CalendarDays}
          />
          <PlaceholderCard
            title={t('employee.monitorSlot.payPreview')}
            icon={Wallet}
          />
        </div>
      </section>
    </div>
  )
}
