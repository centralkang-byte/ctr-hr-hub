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
import { WidgetSkeleton } from '@/components/shared/WidgetSkeleton'
import { UnifiedTaskHub } from './UnifiedTaskHub'
import { NudgeCards } from './NudgeCards'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { TYPOGRAPHY, CARD_STYLES } from '@/lib/styles'
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
    <div className="space-y-8">
      {/* ── Greeting ── */}
      <div>
        <h1 className={TYPOGRAPHY.pageTitle}>
          안녕하세요, {user.name}님 👋
        </h1>
        <p className={`mt-1 ${TYPOGRAPHY.caption}`}>전사 인사 현황을 확인하세요.</p>
      </div>

      {/* ── AI Nudge Cards ── */}
      <NudgeCards user={user} />

      {/* ── KPI Row ── */}
      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <WidgetSkeleton key={i} height="h-28" lines={2} />
          ))}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* 전사 인원 */}
          <div className={CARD_STYLES.kpi}>
            <div className="flex items-center justify-between">
              <div>
                <p className={TYPOGRAPHY.label}>전사 인원</p>
                <p className={`mt-1 ${TYPOGRAPHY.stat}`}>
                  <AnimatedNumber value={summary?.totalEmployees ?? 0} />
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-emerald-500" />
              <span className="text-xs text-emerald-600 font-medium">+{summary?.newHires ?? 0} 이번 달</span>
            </div>
          </div>

          {/* 신규 입사 */}
          <div className={CARD_STYLES.kpi}>
            <div className="flex items-center justify-between">
              <div>
                <p className={TYPOGRAPHY.label}>신규 입사</p>
                <p className={`mt-1 text-3xl font-bold tabular-nums text-emerald-600`}>
                  <AnimatedNumber value={summary?.newHires ?? 0} />
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50">
                <ArrowUpRight className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
            <p className={`mt-3 ${TYPOGRAPHY.caption}`}>최근 30일</p>
          </div>

          {/* 퇴사자 */}
          <div className={CARD_STYLES.kpi}>
            <div className="flex items-center justify-between">
              <div>
                <p className={TYPOGRAPHY.label}>퇴사자</p>
                <p className={`mt-1 text-3xl font-bold tabular-nums text-red-500`}>
                  <AnimatedNumber value={summary?.terminations ?? 0} />
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50">
                <TrendingDown className="h-5 w-5 text-red-400" />
              </div>
            </div>
            <p className={`mt-3 ${TYPOGRAPHY.caption}`}>최근 30일</p>
          </div>

          {/* 이직률 */}
          <div className={CARD_STYLES.kpi}>
            <div className="flex items-center justify-between">
              <div>
                <p className={TYPOGRAPHY.label}>이직률</p>
                <p className={`mt-1 ${TYPOGRAPHY.stat}`}>
                  <AnimatedNumber
                    value={summary?.turnoverRate ?? 0}
                    formatter={(n) => `${n.toFixed(1)}%`}
                  />
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
            </div>
            <p className={`mt-3 ${TYPOGRAPHY.caption}`}>
              대기 휴가: {summary?.pendingLeaves ?? 0}건
            </p>
          </div>
        </div>
      )}

      {/* ── Main layout: TaskHub left, Compact sidebar right ── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* UnifiedTaskHub */}
        <UnifiedTaskHub user={user} />

        {/* Right sidebar — compact above-fold cards only */}
        <div className="space-y-4">
          {/* 승인 대기 현황 */}
          <Card className="bg-primary/5">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                <CheckSquare className="h-4 w-4 text-primary" />
                승인 대기 현황
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pb-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">휴가 신청</span>
                <StatusBadge variant="info">{summary?.pendingLeaves ?? 0}건</StatusBadge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">프로필 변경</span>
                <StatusBadge variant="info">5건</StatusBadge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">급여 조정</span>
                <StatusBadge variant="info">3건</StatusBadge>
              </div>
              <Link
                href="/approvals/inbox"
                className="block pt-1 text-center text-xs font-medium text-primary hover:underline"
              >
                승인함 바로가기 →
              </Link>
            </CardContent>
          </Card>

          {/* 퇴직 진행 현황 */}
          <Card>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                <UserMinus className="h-4 w-4 text-amber-500" />
                퇴직 진행 현황
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pb-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">퇴직 예정</span>
                <StatusBadge variant="warning">{summary?.terminations ?? 0}명</StatusBadge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">인수인계 진행 중</span>
                <StatusBadge variant="warning">1명</StatusBadge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">이번 달 퇴직</span>
                <StatusBadge variant="danger">{summary?.terminations ?? 0}명</StatusBadge>
              </div>
              <Link
                href="/offboarding"
                className="block pt-1 text-center text-xs font-medium text-primary hover:underline"
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
