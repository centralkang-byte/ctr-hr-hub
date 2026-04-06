'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Manager Home (Stage 5-A Rebuild)
// 매니저 전용 홈. NudgeCards + UnifiedTaskHub + 팀 현황.
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import {
  Users,
  CalendarDays,
  MessageSquare,
  TrendingUp,
  CheckSquare,
  UserCheck,
  ClipboardCheck,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { UnifiedTaskHub } from './UnifiedTaskHub'
import { NudgeCards } from './NudgeCards'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'

// ─── Types ────────────────────────────────────────────────

interface ManagerHomeProps {
  user: SessionUser
}

interface ManagerSummary {
  role:      string
  teamCount: number
  newHires?: number
  pendingLeaves?: number
  scheduledOneOnOnes?: number
  quarterlyReviewStats?: { total: number; completed: number; pending: number }
}

// ─── Component ────────────────────────────────────────────

export function ManagerHome({ user }: ManagerHomeProps) {
  const t = useTranslations('home')
  const [summary, setSummary] = useState<ManagerSummary | null>(null)

  useEffect(() => {
    apiClient
      .get<ManagerSummary>('/api/v1/home/summary')
      .then((res) => setSummary(res.data))
      .catch(() => {})
  }, [])

  return (
    <div className="space-y-6">
      {/* ── Greeting ── */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {t('employee.greetingName', { name: user.name })}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('manager.greetingDesc')}</p>
      </div>

      {/* ── Nudge Cards (proactive AI alerts) ── */}
      <NudgeCards user={user} />

      {/* ── Main 2-column layout ── */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* UnifiedTaskHub — left / main */}
        <UnifiedTaskHub user={user} />

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* 팀 현황 */}
          <Card className="border-border shadow-none">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Users className="h-4 w-4 text-primary" />
                {t('manager.teamStatus')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pb-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xl font-bold text-primary">{summary ? summary.teamCount : '-'}</p>
                  <p className="text-xs text-muted-foreground">{t('manager.total')}</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-amber-500">{summary ? summary.pendingLeaves ?? 0 : '-'}</p>
                  <p className="text-xs text-muted-foreground">{t('manager.pendingLeave')}</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-muted-foreground">{summary ? summary.scheduledOneOnOnes ?? 0 : '-'}</p>
                  <p className="text-xs text-muted-foreground">{t('manager.scheduled1on1')}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('manager.totalMembers', { count: summary?.teamCount ?? '-' })}
              </p>
              <Link
                href="/attendance/team"
                className="block text-center text-xs font-medium text-primary hover:underline"
              >
                {t('manager.teamAttendanceDetail')}
              </Link>
            </CardContent>
          </Card>

          {/* 승인 대기 */}
          <Card className="border-border shadow-none">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <CheckSquare className="h-4 w-4 text-red-500" />
                {t('manager.pendingApproval')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {t('manager.leaveRequest')}
                </div>
                <Badge className="bg-destructive/50 text-[10px] text-white">
                  {t('nudge.countBadge', { count: summary?.pendingLeaves ?? 0 })}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <TrendingUp className="h-3.5 w-3.5" />
                  {t('manager.mboGoalApproval')}
                </div>
                <Badge variant="secondary" className="text-[10px]">{t('nudge.countBadge', { count: summary?.scheduledOneOnOnes ?? 0 })}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* 분기 리뷰 현황 */}
          <Card>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ClipboardCheck className="h-4 w-4 text-primary" />
                {t('manager.quarterlyReview')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pb-4">
              {(() => {
                const stats = summary?.quarterlyReviewStats
                if (!stats || stats.total === 0) {
                  return (
                    <p className="text-sm text-muted-foreground">
                      {t('manager.noReviewYet')}
                    </p>
                  )
                }
                const pct = Math.round((stats.completed / stats.total) * 100)
                return (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{t('manager.completed')}</span>
                      <span className="text-sm font-bold text-foreground">
                        {stats.completed}/{stats.total}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                      <div
                        className="h-1.5 rounded-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {stats.pending > 0 && (
                      <p className="text-xs text-amber-600">
                        {t('manager.incomplete', { count: stats.pending })}
                      </p>
                    )}
                  </>
                )
              })()}
              <Link
                href="/performance/quarterly-reviews"
                className="block pt-1 text-center text-xs font-medium text-primary hover:underline"
              >
                {t('manager.manageQuarterlyReview')}
              </Link>
            </CardContent>
          </Card>

          {/* 1:1 미팅 */}
          <Card className="border-border shadow-none">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <MessageSquare className="h-4 w-4 text-violet-500" />
                {t('manager.oneOnOneMeeting')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pb-4">
              {/* TODO: replace with API data */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">박지수</p>
                  <p className="text-xs text-muted-foreground">주간 1:1</p>
                </div>
                <Badge className="bg-primary text-[10px] text-white">오늘 14:00</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">최현우</p>
                  <p className="text-xs text-muted-foreground">월간 체크인</p>
                </div>
                <Badge variant="secondary" className="text-[10px]">내일 10:00</Badge>
              </div>
              <Link
                href="/performance/one-on-one"
                className="block pt-1 text-center text-xs font-medium text-primary hover:underline"
              >
                {t('manager.viewAllMeetings')}
              </Link>
            </CardContent>
          </Card>

          {/* 팀원 현황 */}
          <Card className="border-border shadow-none">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <UserCheck className="h-4 w-4 text-primary" />
                {t('manager.teamMembers')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pb-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('manager.totalTeamMembers')}</span>
                <span className="text-lg font-bold text-primary">
                  {summary?.teamCount ?? '-'}{t('unitPerson')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('manager.newHires')}</span>
                <span className="text-sm font-medium text-primary">{summary?.newHires ?? 0}{t('unitPerson')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('manager.pendingLeaveApproval')}</span>
                <span className="text-sm font-medium text-amber-500">{t('nudge.countBadge', { count: summary?.pendingLeaves ?? 0 })}</span>
              </div>
              <Link
                href="/manager-hub"
                className="block pt-1 text-center text-xs font-medium text-primary hover:underline"
              >
                {t('manager.teamOverview')}
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
