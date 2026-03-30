'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Manager Home (Stage 5-A Rebuild)
// 매니저 전용 홈. NudgeCards + UnifiedTaskHub + 팀 현황.
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Users,
  CalendarDays,
  MessageSquare,
  TrendingUp,
  CheckSquare,
  UserCheck,
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
}

// ─── Component ────────────────────────────────────────────

export function ManagerHome({ user }: ManagerHomeProps) {
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
          안녕하세요, {user.name}님 👋
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">팀 현황을 한눈에 확인하세요.</p>
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
                팀 현황
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pb-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xl font-bold text-primary">{summary ? summary.teamCount : '-'}</p>
                  <p className="text-xs text-muted-foreground">전체</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-amber-500">{summary ? summary.pendingLeaves ?? 0 : '-'}</p>
                  <p className="text-xs text-muted-foreground">휴가 대기</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-muted-foreground">{summary ? summary.scheduledOneOnOnes ?? 0 : '-'}</p>
                  <p className="text-xs text-muted-foreground">예정 1:1</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                전체 {summary?.teamCount ?? '-'}명
              </p>
              <Link
                href="/attendance/team"
                className="block text-center text-xs font-medium text-primary hover:underline"
              >
                팀 근태 상세 →
              </Link>
            </CardContent>
          </Card>

          {/* 승인 대기 */}
          <Card className="border-border shadow-none">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <CheckSquare className="h-4 w-4 text-red-500" />
                승인 대기
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" />
                  휴가 신청
                </div>
                <Badge className="bg-red-500 text-[10px] text-white">
                  {summary?.pendingLeaves ?? 0}건
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <TrendingUp className="h-3.5 w-3.5" />
                  MBO 목표 승인
                </div>
                <Badge variant="secondary" className="text-[10px]">{summary?.scheduledOneOnOnes ?? 0}건</Badge>
              </div>
            </CardContent>
          </Card>

          {/* 1:1 미팅 */}
          <Card className="border-border shadow-none">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <MessageSquare className="h-4 w-4 text-violet-500" />
                1:1 미팅
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pb-4">
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
                전체 보기 →
              </Link>
            </CardContent>
          </Card>

          {/* 팀원 현황 */}
          <Card className="border-border shadow-none">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <UserCheck className="h-4 w-4 text-primary" />
                팀원 현황
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pb-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">전체 팀원</span>
                <span className="text-lg font-bold text-primary">
                  {summary?.teamCount ?? '-'}명
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">신규 입사</span>
                <span className="text-sm font-medium text-primary">{summary?.newHires ?? 0}명</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">승인 대기 휴가</span>
                <span className="text-sm font-medium text-amber-500">{summary?.pendingLeaves ?? 0}건</span>
              </div>
              <Link
                href="/manager-hub"
                className="block pt-1 text-center text-xs font-medium text-primary hover:underline"
              >
                팀 전체 현황 →
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
