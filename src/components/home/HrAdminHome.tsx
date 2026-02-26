'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — HR Admin Home
// HR 관리자 / 슈퍼관리자 대시보드
// ═══════════════════════════════════════════════════════════

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
import type { SessionUser } from '@/types'

// ─── Props ────────────────────────────────────────────────

interface HrAdminHomeProps {
  user: SessionUser
}

// ─── Component ────────────────────────────────────────────

export function HrAdminHome({ user }: HrAdminHomeProps) {
  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-ctr-gray-900">
          안녕하세요, {user.name}님
        </h1>
        <p className="mt-1 text-sm text-ctr-gray-500">
          전사 인사 현황을 확인하세요.
        </p>
      </div>

      {/* KPI Cards Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-ctr-gray-500">전사 인원</p>
                <p className="text-2xl font-bold text-ctr-gray-900">1,247</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50">
                <Users className="h-5 w-5 text-ctr-primary" />
              </div>
            </div>
            <div className="mt-2 flex items-center text-xs text-green-600">
              <TrendingUp className="mr-1 h-3 w-3" />
              +12 이번 달
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-ctr-gray-500">신규 입사</p>
                <p className="text-2xl font-bold text-green-600">18</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50">
                <ArrowUpRight className="h-5 w-5 text-green-600" />
              </div>
            </div>
            <p className="mt-2 text-xs text-ctr-gray-500">이번 분기</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-ctr-gray-500">퇴사자</p>
                <p className="text-2xl font-bold text-ctr-accent">5</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50">
                <TrendingDown className="h-5 w-5 text-ctr-accent" />
              </div>
            </div>
            <p className="mt-2 text-xs text-ctr-gray-500">이번 분기</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-ctr-gray-500">이직률</p>
                <p className="text-2xl font-bold text-ctr-gray-900">3.2%</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-50">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
              </div>
            </div>
            <p className="mt-2 text-xs text-green-600">전월 대비 -0.3%p</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* 채용 파이프라인 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-ctr-gray-700">
              <Briefcase className="mr-2 inline-block h-4 w-4" />
              채용 파이프라인
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { stage: '서류 심사', count: 45, color: 'bg-blue-500' },
                { stage: '1차 면접', count: 18, color: 'bg-ctr-primary' },
                { stage: '2차 면접', count: 8, color: 'bg-purple-500' },
                { stage: '최종 합격', count: 3, color: 'bg-green-500' },
              ].map((item) => (
                <div key={item.stage} className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${item.color}`} />
                  <span className="flex-1 text-sm text-ctr-gray-700">
                    {item.stage}
                  </span>
                  <span className="text-sm font-bold text-ctr-gray-900">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 이직 위험 Top 5 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-ctr-gray-700">
              <AlertTriangle className="mr-2 inline-block h-4 w-4" />
              이직 위험 Top 5
            </CardTitle>
            <AiGeneratedBadge />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { name: '정대현', dept: 'SW개발팀', risk: 87 },
                { name: '한수진', dept: '품질관리팀', risk: 82 },
                { name: '오세훈', dept: 'IT인프라팀', risk: 78 },
                { name: '임지은', dept: '재무팀', risk: 75 },
                { name: '강동원', dept: '영업팀', risk: 71 },
              ].map((person) => (
                <div
                  key={person.name}
                  className="flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-ctr-gray-700">
                      {person.name}
                    </p>
                    <p className="text-xs text-ctr-gray-500">{person.dept}</p>
                  </div>
                  <Badge
                    variant="destructive"
                    className="text-xs"
                  >
                    {person.risk}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 퇴직 진행 현황 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-ctr-gray-700">
              <UserMinus className="mr-2 inline-block h-4 w-4" />
              퇴직 진행 현황
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-ctr-gray-500">퇴직 예정</span>
                <Badge variant="secondary" className="text-xs">2명</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-ctr-gray-500">인수인계 진행 중</span>
                <Badge variant="secondary" className="text-xs">1명</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-ctr-gray-500">퇴직 면담 완료</span>
                <Badge variant="secondary" className="text-xs">3명</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-ctr-gray-500">이번 달 퇴직</span>
                <Badge className="bg-ctr-accent text-xs">2명</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 승인 대기 */}
        <Card className="border-l-4 border-l-ctr-accent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-ctr-gray-700">
              <CheckSquare className="mr-2 inline-block h-4 w-4" />
              승인 대기
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-ctr-gray-500">휴가 신청</span>
                <Badge className="bg-ctr-accent text-xs">12건</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-ctr-gray-500">프로필 변경</span>
                <Badge className="bg-ctr-accent text-xs">5건</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-ctr-gray-500">급여 조정</span>
                <Badge className="bg-ctr-accent text-xs">3건</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI 인사이트 */}
        <Card className="sm:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-ctr-gray-700">
              AI 인사이트
            </CardTitle>
            <AiGeneratedBadge />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                <p className="text-sm font-medium text-yellow-800">
                  SW개발팀 이직 위험도 상승
                </p>
                <p className="mt-1 text-xs text-yellow-700">
                  최근 3개월간 SW개발팀의 이직 위험도가 15%p 상승했습니다.
                  동종 업계 대비 보상 수준 검토를 권장합니다.
                </p>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <p className="text-sm font-medium text-blue-800">
                  온보딩 완료율 개선
                </p>
                <p className="mt-1 text-xs text-blue-700">
                  이번 분기 신규 입사자 온보딩 완료율이 92%로 전 분기 대비 8%p
                  향상되었습니다.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
