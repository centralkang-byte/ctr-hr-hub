'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Employee Home (Stage 5-A Rebuild)
// 직원 전용 홈. UnifiedTaskHub 중심 레이아웃.
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Clock,
  CalendarDays,
  FileText,
  LogIn,
  LogOut,
  Award,
  TrendingUp,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { UnifiedTaskHub } from './UnifiedTaskHub'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import { BUTTON_VARIANTS } from '@/lib/styles'

// ─── Types ────────────────────────────────────────────────

interface EmployeeHomeProps {
  user: SessionUser
}

interface EmployeeSummary {
  role: string
  totalEmployees: number
  leaveBalance: { policy: string; remaining: number; used: number; total: number }[]
  attendanceThisMonth: number
}

// ─── Component ────────────────────────────────────────────

export function EmployeeHome({ user }: EmployeeHomeProps) {
  const [summary, setSummary] = useState<EmployeeSummary | null>(null)

  useEffect(() => {
    apiClient
      .get<EmployeeSummary>('/api/v1/home/summary')
      .then((res) => setSummary(res.data))
      .catch(() => {})
  }, [])

  const annualLeave = summary?.leaveBalance?.find(
    (lb) => lb.policy.includes('연차') || lb.policy.includes('Annual'),
  )

  return (
    <div className="space-y-6">
      {/* ── Greeting ── */}
      <div>
        <h1 className="text-2xl font-bold text-[#1C1D21]">
          안녕하세요, {user.name}님 👋
        </h1>
        <p className="mt-1 text-sm text-[#8181A5]">오늘도 좋은 하루 되세요.</p>
      </div>

      {/* ── Quick Actions ── */}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          className={`gap-1.5 ${BUTTON_VARIANTS.primary}`}
        >
          <LogIn className="h-4 w-4" />
          출근
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" disabled>
          <LogOut className="h-4 w-4" />
          퇴근
        </Button>
        <Link href="/leave">
          <Button size="sm" variant="outline" className="gap-1.5">
            <CalendarDays className="h-4 w-4" />
            휴가신청
          </Button>
        </Link>
        <Link href="/payroll/me">
          <Button size="sm" variant="outline" className="gap-1.5">
            <FileText className="h-4 w-4" />
            급여명세서
          </Button>
        </Link>
      </div>

      {/* ── Main 2-column layout ── */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* UnifiedTaskHub — left / main */}
        <UnifiedTaskHub user={user} />

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* 나의 현황 */}
          <Card className="border-[#F0F0F3] shadow-none">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-semibold text-[#1C1D21]">
                나의 현황
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pb-4">
              {/* 근태 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-[#8181A5]">
                  <Clock className="h-4 w-4" />
                  이번 달 근무
                </div>
                <span className="text-sm font-bold text-[#1C1D21]">
                  {summary?.attendanceThisMonth ?? '-'}일
                </span>
              </div>

              {/* 잔여 연차 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-[#8181A5]">
                    <CalendarDays className="h-4 w-4" />
                    잔여 연차
                  </div>
                  <span className="text-sm font-bold text-[#4F46E5]">
                    {annualLeave ? `${annualLeave.remaining}일` : '-'}
                  </span>
                </div>
                {annualLeave && (
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#F0F0F3]">
                    <div
                      className="h-1.5 rounded-full bg-[#4F46E5] transition-all"
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
          <Card className="border-[#F0F0F3] shadow-none">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#1C1D21]">
                <Award className="h-4 w-4 text-[#F59E0B]" />
                최근 받은 칭찬
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pb-4">
              <div className="rounded-lg bg-[#F5F5FA] p-3">
                <p className="text-sm font-medium text-[#1C1D21]">
                  &quot;프로젝트 기여에 감사합니다!&quot;
                </p>
                <p className="mt-1 text-xs text-[#8181A5]">김팀장 · 도전</p>
              </div>
              <div className="rounded-lg bg-[#F5F5FA] p-3">
                <p className="text-sm font-medium text-[#1C1D21]">
                  &quot;꼼꼼한 리뷰 감사합니다&quot;
                </p>
                <p className="mt-1 text-xs text-[#8181A5]">박과장 · 신뢰</p>
              </div>
              <Link
                href="/performance/recognition"
                className="block pt-1 text-center text-xs font-medium text-[#4F46E5] hover:underline"
              >
                전체 보기 →
              </Link>
            </CardContent>
          </Card>

          {/* 성과 진행률 */}
          <Card className="border-[#F0F0F3] shadow-none">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#1C1D21]">
                <TrendingUp className="h-4 w-4 text-[#4F46E5]" />
                MBO 달성률
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#8181A5]">2026 H1</span>
                  <span className="text-sm font-bold text-[#1C1D21]">72%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#F0F0F3]">
                  <div
                    className="h-1.5 rounded-full bg-[#4F46E5]"
                    style={{ width: '72%' }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-[#8181A5]">
                  <span>설정된 목표 5개</span>
                  <Badge variant="outline" className="text-[10px]">진행 중</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
