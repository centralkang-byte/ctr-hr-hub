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
  Briefcase,
  AlertTriangle,
  UserMinus,
  CheckSquare,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AiGeneratedBadge } from '@/components/shared/AiGeneratedBadge'
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

      {/* ── Main layout: TaskHub left, Details right ── */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* UnifiedTaskHub */}
        <UnifiedTaskHub user={user} />

        {/* Right sidebar — detail cards */}
        <div className="space-y-4">
          {/* 채용 파이프라인 */}
          <Card className="border-[#F0F0F3] shadow-none">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#1C1D21]">
                <Briefcase className="h-4 w-4 text-[#5E81F4]" />
                채용 파이프라인
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pb-4">
              {[
                { stage: '서류 심사', count: 45, color: 'bg-[#5E81F4]' },
                { stage: '1차 면접',  count: 18, color: 'bg-[#00C853]' },
                { stage: '2차 면접',  count: 8,  color: 'bg-[#A855F7]' },
                { stage: '최종 합격', count: 3,  color: 'bg-green-500' },
              ].map((item) => (
                <div key={item.stage} className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${item.color}`} />
                  <span className="flex-1 text-sm text-[#8181A5]">{item.stage}</span>
                  <span className="text-sm font-bold text-[#1C1D21]">{item.count}</span>
                </div>
              ))}
              <Link
                href="/recruitment/dashboard"
                className="block pt-1 text-center text-xs font-medium text-[#5E81F4] hover:underline"
              >
                채용 대시보드 →
              </Link>
            </CardContent>
          </Card>

          {/* 이직 위험 Top 5 */}
          <Card className="border-[#F0F0F3] shadow-none">
            <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#1C1D21]">
                <AlertTriangle className="h-4 w-4 text-[#EF4444]" />
                이직 위험 Top 5
              </CardTitle>
              <AiGeneratedBadge />
            </CardHeader>
            <CardContent className="space-y-2 pb-4">
              {[
                { name: '정대현', dept: 'SW개발팀', risk: 87 },
                { name: '한수진', dept: '품질관리팀', risk: 82 },
                { name: '오세훈', dept: 'IT인프라팀', risk: 78 },
                { name: '임지은', dept: '재무팀', risk: 75 },
                { name: '강동원', dept: '영업팀', risk: 71 },
              ].map((person) => (
                <div key={person.name} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#1C1D21]">{person.name}</p>
                    <p className="text-xs text-[#8181A5]">{person.dept}</p>
                  </div>
                  <Badge variant="destructive" className="text-xs">
                    {person.risk}%
                  </Badge>
                </div>
              ))}
              <Link
                href="/analytics/predictive"
                className="block pt-1 text-center text-xs font-medium text-[#5E81F4] hover:underline"
              >
                예측 분석 →
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
            <CardContent className="space-y-2 pb-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#8181A5]">퇴직 예정</span>
                <Badge variant="secondary" className="text-[10px]">2명</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#8181A5]">인수인계 진행 중</span>
                <Badge variant="secondary" className="text-[10px]">1명</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#8181A5]">이번 달 퇴직</span>
                <Badge className="bg-[#5E81F4] text-[10px] text-white">2명</Badge>
              </div>
              <Link
                href="/offboarding"
                className="block pt-1 text-center text-xs font-medium text-[#5E81F4] hover:underline"
              >
                퇴직 관리 →
              </Link>
            </CardContent>
          </Card>

          {/* 승인 대기 */}
          <Card className="border-l-4 border-[#F0F0F3] border-l-[#5E81F4] shadow-none">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#1C1D21]">
                <CheckSquare className="h-4 w-4 text-[#5E81F4]" />
                승인 대기 현황
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pb-4">
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
            </CardContent>
          </Card>

          {/* AI 인사이트 */}
          <Card className="border-[#F0F0F3] shadow-none">
            <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4">
              <CardTitle className="text-sm font-semibold text-[#1C1D21]">
                AI 인사이트
              </CardTitle>
              <AiGeneratedBadge />
            </CardHeader>
            <CardContent className="space-y-2 pb-4">
              <div className="rounded-lg border border-[#FDE68A] bg-[#FEFCE8] p-3">
                <p className="text-sm font-medium text-[#854D0E]">
                  SW개발팀 이직 위험도 상승
                </p>
                <p className="mt-1 text-xs text-[#A16207]">
                  최근 3개월간 이직 위험도가 15%p 상승했습니다.
                </p>
              </div>
              <div className="rounded-lg border border-[#D1FAE5] bg-[#ECFDF5] p-3">
                <p className="text-sm font-medium text-[#065F46]">
                  온보딩 완료율 개선
                </p>
                <p className="mt-1 text-xs text-[#059669]">
                  이번 분기 온보딩 완료율 92% (+8%p)
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
