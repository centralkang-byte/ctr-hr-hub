'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — HR Admin Home (Stage 5-A Rebuild)
// HR 관리자 / 슈퍼관리자 대시보드
// NudgeCards + UnifiedTaskHub + KPI 그리드
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Users,
  AlertTriangle,
  UserMinus,
  CheckSquare,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { WidgetSkeleton } from '@/components/shared/WidgetSkeleton'
import { UnifiedTaskHub } from './UnifiedTaskHub'
import { NudgeCards } from './NudgeCards'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'

// ─── Props ────────────────────────────────────────────────

interface HrAdminHomeProps {
  user: SessionUser
}

interface HrAdminSummary {
  role: string
  totalEmployees: number
  newHires: number
  terminations: number
  turnoverRate: number
  openPositions: number
  pendingLeaves: number
}

// ─── Component ────────────────────────────────────────────

export function HrAdminHome({ user }: HrAdminHomeProps) {
  const [summary, setSummary] = useState<HrAdminSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiClient
      .get<HrAdminSummary>('/api/v1/home/summary')
      .then((res) => setSummary(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      {/* ── Greeting ── */}
      <div>
        <h1 className="text-2xl font-bold text-[#1C1D21]">
          안녕하세요, {user.name}님 👋
        </h1>
        <p className="mt-1 text-sm text-[#8181A5]">전사 인사 현황을 확인하세요.</p>
      </div>

      {/* ── AI Nudge Cards ── */}
      <NudgeCards user={user} />

      {/* ── KPI Row ── */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <WidgetSkeleton key={i} height="h-28" lines={2} />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-[#F0F0F3] shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-[#8181A5]">전사 인원</p>
                  <p className="text-2xl font-bold text-[#1C1D21]">
                    {summary?.totalEmployees?.toLocaleString() ?? '-'}
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EEF1FF]">
                  <Users className="h-5 w-5 text-[#5E81F4]" />
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1 text-xs text-[#00C853]">
                <TrendingUp className="h-3 w-3" />
                +{summary?.newHires ?? 0} 이번 달
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#F0F0F3] shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-[#8181A5]">신규 입사</p>
                  <p className="text-2xl font-bold text-[#00C853]">
                    {summary?.newHires ?? '-'}
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E8F5E9]">
                  <ArrowUpRight className="h-5 w-5 text-[#00C853]" />
                </div>
              </div>
              <p className="mt-2 text-xs text-[#8181A5]">최근 30일</p>
            </CardContent>
          </Card>

          <Card className="border-[#F0F0F3] shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-[#8181A5]">퇴사자</p>
                  <p className="text-2xl font-bold text-[#EF4444]">
                    {summary?.terminations ?? '-'}
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FEE2E2]">
                  <TrendingDown className="h-5 w-5 text-[#EF4444]" />
                </div>
              </div>
              <p className="mt-2 text-xs text-[#8181A5]">최근 30일</p>
            </CardContent>
          </Card>

          <Card className="border-[#F0F0F3] shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-[#8181A5]">이직률</p>
                  <p className="text-2xl font-bold text-[#1C1D21]">
                    {summary?.turnoverRate ?? '-'}%
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FEFCE8]">
                  <AlertTriangle className="h-5 w-5 text-[#CA8A04]" />
                </div>
              </div>
              <p className="mt-2 text-xs text-[#8181A5]">
                대기 휴가: {summary?.pendingLeaves ?? 0}건
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Main layout: TaskHub left, Compact sidebar right ── */}
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        {/* UnifiedTaskHub */}
        <UnifiedTaskHub user={user} />

        {/* Right sidebar — compact above-fold cards only */}
        <div className="space-y-4">
          {/* 승인 대기 현황 */}
          <Card className="border-l-4 border-[#F0F0F3] border-l-[#5E81F4] shadow-none">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#1C1D21]">
                <CheckSquare className="h-4 w-4 text-[#5E81F4]" />
                승인 대기 현황
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pb-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#8181A5]">휴가 신청</span>
                <Badge className="bg-[#5E81F4] text-[10px] text-white">
                  {summary?.pendingLeaves ?? 0}건
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#8181A5]">프로필 변경</span>
                <Badge className="bg-[#5E81F4] text-[10px] text-white">5건</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#8181A5]">급여 조정</span>
                <Badge className="bg-[#5E81F4] text-[10px] text-white">3건</Badge>
              </div>
              <Link
                href="/approvals/inbox"
                className="block pt-1 text-center text-xs font-medium text-[#5E81F4] hover:underline"
              >
                승인함 바로가기 →
              </Link>
            </CardContent>
          </Card>

          {/* 퇴직 진행 현황 */}
          <Card className="border-[#F0F0F3] shadow-none">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#1C1D21]">
                <UserMinus className="h-4 w-4 text-[#F59E0B]" />
                퇴직 진행 현황
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pb-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#8181A5]">퇴직 예정</span>
                <Badge variant="secondary" className="text-[10px]">
                  {summary?.terminations ?? 0}명
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#8181A5]">인수인계 진행 중</span>
                <Badge variant="secondary" className="text-[10px]">1명</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#8181A5]">이번 달 퇴직</span>
                <Badge className="bg-[#5E81F4] text-[10px] text-white">
                  {summary?.terminations ?? 0}명
                </Badge>
              </div>
              <Link
                href="/offboarding"
                className="block pt-1 text-center text-xs font-medium text-[#5E81F4] hover:underline"
              >
                퇴직관리 →
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
