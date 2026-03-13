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
        <h1 className="text-2xl font-bold text-[#1C1D21]">
          안녕하세요, {user.name}님 👋
        </h1>
        <p className="mt-1 text-sm text-[#8181A5]">팀 현황을 한눈에 확인하세요.</p>
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
          <Card className="border-[#F0F0F3] shadow-none">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#1C1D21]">
                <Users className="h-4 w-4 text-[#4F46E5]" />
                팀 현황
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pb-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xl font-bold text-[#4F46E5]">8</p>
                  <p className="text-xs text-[#8181A5]">출근</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-[#F59E0B]">2</p>
                  <p className="text-xs text-[#8181A5]">휴가</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-[#8181A5]">1</p>
                  <p className="text-xs text-[#8181A5]">미출근</p>
                </div>
              </div>
              <p className="text-xs text-[#8181A5]">
                전체 {summary?.teamCount ?? '-'}명
              </p>
              <Link
                href="/attendance/team"
                className="block text-center text-xs font-medium text-[#4F46E5] hover:underline"
              >
                팀 근태 상세 →
              </Link>
            </CardContent>
          </Card>

          {/* 승인 대기 */}
          <Card className="border-[#F0F0F3] shadow-none">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#1C1D21]">
                <CheckSquare className="h-4 w-4 text-[#EF4444]" />
                승인 대기
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-sm text-[#8181A5]">
                  <CalendarDays className="h-3.5 w-3.5" />
                  휴가 신청
                </div>
                <Badge className="bg-[#EF4444] text-[10px] text-white">
                  {summary?.pendingLeaves ?? 0}건
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-sm text-[#8181A5]">
                  <TrendingUp className="h-3.5 w-3.5" />
                  MBO 목표 승인
                </div>
                <Badge variant="secondary" className="text-[10px]">2건</Badge>
              </div>
            </CardContent>
          </Card>

          {/* 1:1 미팅 */}
          <Card className="border-[#F0F0F3] shadow-none">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#1C1D21]">
                <MessageSquare className="h-4 w-4 text-[#A855F7]" />
                1:1 미팅
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#1C1D21]">박지수</p>
                  <p className="text-xs text-[#8181A5]">주간 1:1</p>
                </div>
                <Badge className="bg-[#4F46E5] text-[10px] text-white">오늘 14:00</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#1C1D21]">최현우</p>
                  <p className="text-xs text-[#8181A5]">월간 체크인</p>
                </div>
                <Badge variant="secondary" className="text-[10px]">내일 10:00</Badge>
              </div>
              <Link
                href="/performance/one-on-one"
                className="block pt-1 text-center text-xs font-medium text-[#4F46E5] hover:underline"
              >
                전체 보기 →
              </Link>
            </CardContent>
          </Card>

          {/* 팀원 현황 */}
          <Card className="border-[#F0F0F3] shadow-none">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#1C1D21]">
                <UserCheck className="h-4 w-4 text-[#4F46E5]" />
                팀원 현황
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pb-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#8181A5]">전체 팀원</span>
                <span className="text-lg font-bold text-[#4F46E5]">
                  {summary?.teamCount ?? '-'}명
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#8181A5]">신규 입사</span>
                <span className="text-sm font-medium text-[#4F46E5]">2명</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#8181A5]">수습 중</span>
                <span className="text-sm font-medium text-[#F59E0B]">1명</span>
              </div>
              <Link
                href="/manager-hub"
                className="block pt-1 text-center text-xs font-medium text-[#4F46E5] hover:underline"
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
