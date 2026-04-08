'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Employee Home (Phase 3 Redesign)
// 직원 전용 홈. KpiStrip + DashboardTaskList + 분기리뷰/나의현황.
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import {
  CalendarDays,
  FileText,
  LogIn,
  LogOut,
  Clock,
  ClipboardCheck,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { KpiStrip } from './KpiStrip'
import { DashboardTaskList } from './DashboardTaskList'
import { WidgetSkeleton } from '@/components/shared/WidgetSkeleton'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { BUTTON_VARIANTS } from '@/lib/styles'
import type { SessionUser } from '@/types'

// ─── Types ────────────────────────────────────────────────

interface Props {
  user: SessionUser
}

interface EmployeeSummary {
  role: string
  totalEmployees: number
  leaveBalance: { policy: string; leaveType: string; remaining: number; used: number; total: number }[]
  attendanceThisMonth: number
  quarterlyReview?: { id: string | null; status: string | null }
}

// ─── Component ────────────────────────────────────────────

export function EmployeeHome({ user }: Props) {
  const t = useTranslations('home')
  const [summary, setSummary] = useState<EmployeeSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiClient
      .get<EmployeeSummary>('/api/v1/home/summary')
      .then((res) => setSummary(res.data))
      .catch(() => {
        toast({ title: '로드 실패', variant: 'destructive' })
      })
      .finally(() => setLoading(false))
  }, [])

  const annualLeave = summary?.leaveBalance?.find(
    (lb) => lb.leaveType === 'ANNUAL',
  )

  return (
    <div className="space-y-6">
      {/* ── Greeting ── */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {t('employee.greetingName', { name: user.name })}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('employee.goodDay')}</p>
      </div>

      {/* ── Quick Actions ── */}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          className={`gap-1.5 ${BUTTON_VARIANTS.primary}`}
        >
          <LogIn className="h-4 w-4" />
          {t('employee.clockIn')}
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" disabled>
          <LogOut className="h-4 w-4" />
          {t('employee.clockOut')}
        </Button>
        <Link href="/leave">
          <Button size="sm" variant="outline" className="gap-1.5">
            <CalendarDays className="h-4 w-4" />
            {t('employee.leaveRequest')}
          </Button>
        </Link>
        <Link href="/payroll/me">
          <Button size="sm" variant="outline" className="gap-1.5">
            <FileText className="h-4 w-4" />
            {t('employee.payslip')}
          </Button>
        </Link>
      </div>

      {/* ── KPI Strip ── */}
      {loading ? (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
          {[...Array(2)].map((_, i) => (
            <WidgetSkeleton key={i} height="h-24" lines={2} />
          ))}
        </div>
      ) : (
        <KpiStrip
          hero={{
            label: t('employee.remainingAnnualLeave'),
            value: annualLeave ? `${annualLeave.remaining}` : '-',
            delta: annualLeave
              ? `${annualLeave.used}/${annualLeave.total} used`
              : undefined,
            deltaVariant: annualLeave && annualLeave.remaining <= 3 ? 'bad' : 'muted',
            variant: annualLeave && annualLeave.remaining <= 3 ? 'warn' : 'default',
          }}
          items={[
            {
              label: t('employee.workDaysThisMonth'),
              value: `${summary?.attendanceThisMonth ?? '-'}`,
              delta: t('employee.dayUnit', { count: summary?.attendanceThisMonth ?? 0 }),
              deltaVariant: 'muted',
            },
          ]}
        />
      )}

      {/* ── Main layout: TaskList left, Sidebar right ── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <DashboardTaskList user={user} />

        <div className="space-y-4">
          {/* 분기 리뷰 */}
          <Card>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ClipboardCheck className="h-4 w-4 text-primary" />
                {t('employee.quarterlyReview')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              {(() => {
                const qr = summary?.quarterlyReview
                if (!qr || !qr.status) {
                  return (
                    <p className="text-sm text-muted-foreground">
                      {t('employee.noReviewYet')}
                    </p>
                  )
                }
                const statusMap: Record<string, { label: string; variant: 'info' | 'warning' | 'success' | 'neutral' }> = {
                  DRAFT: { label: t('employee.statusDraft'), variant: 'info' },
                  IN_PROGRESS: { label: t('employee.statusInProgress'), variant: 'warning' },
                  EMPLOYEE_DONE: { label: t('employee.statusEmployeeDone'), variant: 'success' },
                  MANAGER_DONE: { label: t('employee.statusManagerDone'), variant: 'info' },
                  COMPLETED: { label: t('employee.statusCompleted'), variant: 'success' },
                }
                const s = statusMap[qr.status] ?? { label: qr.status, variant: 'neutral' as const }
                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{t('employee.status')}</span>
                      <StatusBadge variant={s.variant}>{s.label}</StatusBadge>
                    </div>
                    {(qr.status === 'DRAFT' || qr.status === 'IN_PROGRESS') && (
                      <Link href="/performance/my-quarterly-review">
                        <Button size="sm" className="w-full gap-1.5">
                          {qr.status === 'DRAFT' ? t('employee.startWriting') : t('employee.continueWriting')}
                        </Button>
                      </Link>
                    )}
                    {qr.status === 'EMPLOYEE_DONE' && (
                      <p className="text-center text-xs text-muted-foreground">{t('employee.awaitingManagerFeedback')}</p>
                    )}
                    {qr.status === 'MANAGER_DONE' && (
                      <p className="text-center text-xs text-muted-foreground">{t('employee.awaitingFinalization')}</p>
                    )}
                    {qr.status === 'COMPLETED' && qr.id && (
                      <Link href={`/performance/quarterly-reviews/${qr.id}`}>
                        <Button size="sm" variant="outline" className="w-full">
                          {t('employee.viewResult')}
                        </Button>
                      </Link>
                    )}
                  </div>
                )
              })()}
            </CardContent>
          </Card>

          {/* 나의 현황 */}
          <Card className="border-border shadow-none">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-semibold text-foreground">
                {t('employee.myStatus')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  {t('employee.workDaysThisMonth')}
                </div>
                <span className="text-sm font-bold text-foreground">
                  {t('employee.dayUnit', { count: summary?.attendanceThisMonth ?? '-' })}
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarDays className="h-4 w-4" />
                    {t('employee.remainingAnnualLeave')}
                  </div>
                  <span className="text-sm font-bold text-primary">
                    {annualLeave ? t('employee.dayUnit', { count: annualLeave.remaining }) : '-'}
                  </span>
                </div>
                {annualLeave && (
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                    <div
                      className="h-1.5 rounded-full bg-primary transition-all"
                      style={{
                        width: `${annualLeave.total > 0 ? (annualLeave.remaining / annualLeave.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
