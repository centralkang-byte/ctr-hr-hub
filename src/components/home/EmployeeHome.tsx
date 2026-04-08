'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Employee Home (Stage 5-A Rebuild)
// 직원 전용 홈. UnifiedTaskHub 중심 레이아웃.
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import {
  Clock,
  CalendarDays,
  FileText,
  LogIn,
  LogOut,
  Award,
  TrendingUp,
  ClipboardCheck,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { TaskSummaryCard } from './TaskSummaryCard'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import { toast } from '@/hooks/use-toast'
import { BUTTON_VARIANTS } from '@/lib/styles'

// ─── Types ────────────────────────────────────────────────

interface EmployeeHomeProps {
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

export function EmployeeHome({ user }: EmployeeHomeProps) {
  const t = useTranslations('home')
  const [summary, setSummary] = useState<EmployeeSummary | null>(null)

  useEffect(() => {
    apiClient
      .get<EmployeeSummary>('/api/v1/home/summary')
      .then((res) => setSummary(res.data))
      .catch(() => {
        toast({ title: '로드 실패', variant: 'destructive' })
      })
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

      {/* ── Main 2-column layout ── */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* UnifiedTaskHub — left / main */}
        <TaskSummaryCard user={user} />

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* 분기 리뷰 — D-7: sidebar 첫 번째 위치 */}
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
              {/* 근태 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  {t('employee.workDaysThisMonth')}
                </div>
                <span className="text-sm font-bold text-foreground">
                  {t('employee.dayUnit', { count: summary?.attendanceThisMonth ?? '-' })}
                </span>
              </div>

              {/* 잔여 연차 */}
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

          {/* 최근 받은 칭찬 */}
          <Card className="border-border shadow-none">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Award className="h-4 w-4 text-amber-500" />
                {t('employee.recentPraise')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pb-4">
              {/* TODO: replace with API data */}
              <div className="rounded-lg bg-muted p-3">
                <p className="text-sm font-medium text-foreground">
                  &quot;프로젝트 기여에 감사합니다!&quot;
                </p>
                <p className="mt-1 text-xs text-muted-foreground">김팀장 · 도전</p>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <p className="text-sm font-medium text-foreground">
                  &quot;꼼꼼한 리뷰 감사합니다&quot;
                </p>
                <p className="mt-1 text-xs text-muted-foreground">박과장 · 신뢰</p>
              </div>
              <Link
                href="/performance/recognition"
                className="block pt-1 text-center text-xs font-medium text-primary hover:underline"
              >
                {t('employee.viewAll')}
              </Link>
            </CardContent>
          </Card>

          {/* 성과 진행률 */}
          <Card className="border-border shadow-none">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <TrendingUp className="h-4 w-4 text-primary" />
                {t('employee.mboAchievement')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">2026 H1</span>
                  <span className="text-sm font-bold text-foreground">72%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                  <div
                    className="h-1.5 rounded-full bg-primary"
                    style={{ width: '72%' }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t('employee.goalsSet', { count: 5 })}</span>
                  <Badge variant="outline" className="text-[10px]">{t('employee.inProgress')}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
