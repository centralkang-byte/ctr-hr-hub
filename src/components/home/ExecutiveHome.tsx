'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Executive Home
// 경영진 대시보드
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import {
  Users,
  TrendingDown,
  BarChart3,
  DollarSign,
  Building2,
  FileText,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AiGeneratedBadge } from '@/components/shared/AiGeneratedBadge'
import { NudgeCards } from './NudgeCards'
import { UnifiedTaskHub } from './UnifiedTaskHub'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'

// ─── Props ────────────────────────────────────────────────

interface ExecutiveHomeProps {
  user: SessionUser
}

interface ExecSummary {
  role: string
  totalEmployees: number
  newHires: number
  terminations: number
  turnoverRate: number
  openPositions: number
  pendingLeaves: number
}

// ─── Component ────────────────────────────────────────────

export function ExecutiveHome({ user }: ExecutiveHomeProps) {
  const [summary, setSummary] = useState<ExecSummary | null>(null)

  useEffect(() => {
    apiClient
      .get<ExecSummary>('/api/v1/home/summary')
      .then((res) => setSummary(res.data))
      .catch(() => {})
  }, [])

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          안녕하세요, {user.name}님 👋
        </h1>
        <p className="mt-1 text-base text-muted-foreground">
          그룹 전체 인사 현황 요약입니다.
        </p>
      </div>

      {/* AI Nudge Cards (EXECUTIVE view) */}
      <NudgeCards user={user} />

      {/* 나의 할 일 */}
      <UnifiedTaskHub user={user} />

      {/* 핵심 KPI Cards — No-Line Rule, Display Typography */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* 전체 인원 */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">전체 인원</p>
                <p className="text-display-sm font-extrabold text-foreground">
                  {summary?.totalEmployees?.toLocaleString() ?? '-'}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
            </div>
            <p className="mt-2 text-xs text-emerald-600">
              전월 대비 +12명 (1.0%)
            </p>
          </CardContent>
        </Card>

        {/* 이직률 */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">이직률</p>
                <p className="text-display-sm font-extrabold text-foreground">
                  {summary?.turnoverRate ?? '-'}%
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <TrendingDown className="h-6 w-6 text-destructive" />
              </div>
            </div>
            <p className="mt-2 text-xs text-emerald-600">
              전월 대비 -0.3%p
            </p>
          </CardContent>
        </Card>

        {/* 성과 분포 */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">성과 분포</p>
                <p className="text-display-sm font-extrabold text-foreground">B+</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-tertiary-container/20">
                <BarChart3 className="h-6 w-6 text-tertiary" />
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              전사 평균 등급
            </p>
          </CardContent>
        </Card>

        {/* 인건비 비율 */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">인건비 비율</p>
                <p className="text-display-sm font-extrabold text-foreground">32.1%</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
                <DollarSign className="h-6 w-6 text-amber-600" />
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              매출 대비 인건비
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detail Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 회사별 현황 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground">
              <Building2 className="mr-2 inline-block h-4 w-4" />
              회사별 현황
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { name: '씨티알모빌리티', count: 420, rate: '2.8%' },
                { name: '씨티알정보통신', count: 310, rate: '3.5%' },
                { name: '씨티알글로벌', count: 185, rate: '4.1%' },
                { name: '씨티알이엔지', count: 152, rate: '2.2%' },
                { name: '씨티알오토모티브', count: 180, rate: '3.9%' },
              ].map((company) => (
                <div
                  key={company.name}
                  className="flex items-center justify-between rounded-lg bg-muted/50 p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {company.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {company.count}명
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-foreground">
                      이직률
                    </p>
                    <p
                      className={`text-xs font-bold ${
                        parseFloat(company.rate) > 3.5
                          ? 'text-destructive'
                          : 'text-green-600'
                      }`}
                    >
                      {company.rate}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* AI 인사이트 + 최근 보고서 */}
        <div className="space-y-4">
          {/* AI 전략 인사이트 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-foreground">
                AI 전략 인사이트
              </CardTitle>
              <AiGeneratedBadge />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="rounded-xl bg-destructive/5 p-3">
                  <p className="text-sm font-medium text-red-800">
                    핵심 인재 유출 위험
                  </p>
                  <p className="mt-1 text-xs text-red-700">
                    SW개발 직군의 이직 위험도가 업계 평균 대비 높은 수준입니다.
                    경쟁력 있는 보상 패키지 검토를 권장합니다.
                  </p>
                </div>
                <div className="rounded-xl bg-tertiary-container/10 p-3">
                  <p className="text-sm font-medium text-green-800">
                    조직 효율성 개선
                  </p>
                  <p className="mt-1 text-xs text-green-700">
                    1인당 생산성이 전년 동기 대비 8% 향상되었습니다.
                    디지털 전환 투자 효과가 나타나고 있습니다.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 최근 보고서 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-foreground">
                <FileText className="mr-2 inline-block h-4 w-4" />
                최근 보고서
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { title: '2026년 1분기 인사 현황 보고서', date: '2026-02-25' },
                  { title: '성과 평가 결과 분석', date: '2026-02-20' },
                  { title: '채용 파이프라인 월간 리포트', date: '2026-02-15' },
                ].map((report) => (
                  <div
                    key={report.title}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm text-foreground">
                      {report.title}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {report.date}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
