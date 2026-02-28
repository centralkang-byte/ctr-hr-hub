'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Manager Home
// 관리자 역할 대시보드
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
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
import { PendingActionsPanel } from './PendingActionsPanel'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'

// ─── Props ────────────────────────────────────────────────

interface ManagerHomeProps {
  user: SessionUser
}

interface ManagerSummary {
  role: string
  totalEmployees: number
  teamCount: number
  pendingLeaves: number
  scheduledOneOnOnes: number
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
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-ctr-gray-900">
          안녕하세요, {user.name}님
        </h1>
        <p className="mt-1 text-sm text-ctr-gray-500">
          팀 현황을 한눈에 확인하세요.
        </p>
      </div>

      {/* Pending Actions */}
      <PendingActionsPanel user={user} />

      {/* Dashboard Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* 팀 근태 현황 */}
        <Card className="border-l-4 border-l-ctr-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-ctr-gray-700">
              <Users className="mr-2 inline-block h-4 w-4" />
              팀 근태 현황
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">8</p>
                <p className="text-xs text-ctr-gray-500">출근</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-600">2</p>
                <p className="text-xs text-ctr-gray-500">휴가</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-ctr-gray-400">1</p>
                <p className="text-xs text-ctr-gray-500">미출근</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-ctr-gray-500">
              전체 11명 중 8명 출근
            </p>
          </CardContent>
        </Card>

        {/* 팀 휴가 달력 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-ctr-gray-700">
              <CalendarDays className="mr-2 inline-block h-4 w-4" />
              팀 휴가 달력
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-lg bg-ctr-gray-50 p-2">
                <div>
                  <p className="text-sm font-medium text-ctr-gray-700">이영희</p>
                  <p className="text-xs text-ctr-gray-500">연차</p>
                </div>
                <Badge variant="outline" className="text-xs">
                  02/26 ~ 02/27
                </Badge>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-ctr-gray-50 p-2">
                <div>
                  <p className="text-sm font-medium text-ctr-gray-700">김민수</p>
                  <p className="text-xs text-ctr-gray-500">반차 (오후)</p>
                </div>
                <Badge variant="outline" className="text-xs">
                  02/28
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 1:1 미팅 일정 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-ctr-gray-700">
              <MessageSquare className="mr-2 inline-block h-4 w-4" />
              1:1 미팅 일정
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-ctr-gray-700">박지수</p>
                  <p className="text-xs text-ctr-gray-500">주간 1:1</p>
                </div>
                <Badge className="bg-ctr-primary text-xs">오늘 14:00</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-ctr-gray-700">최현우</p>
                  <p className="text-xs text-ctr-gray-500">월간 체크인</p>
                </div>
                <Badge variant="secondary" className="text-xs">내일 10:00</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 팀 성과 요약 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-ctr-gray-700">
              <TrendingUp className="mr-2 inline-block h-4 w-4" />
              팀 성과 요약
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-ctr-gray-500">MBO 달성률</span>
                <span className="text-sm font-bold text-ctr-primary">72%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-ctr-gray-100">
                <div
                  className="h-2 rounded-full bg-ctr-primary"
                  style={{ width: '72%' }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-ctr-gray-500">목표 설정 완료</span>
                <span className="text-sm font-medium text-ctr-gray-700">
                  9/11명
                </span>
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
                <Badge className="bg-ctr-accent text-xs">3건</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-ctr-gray-500">MBO 목표 승인</span>
                <Badge className="bg-ctr-accent text-xs">2건</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-ctr-gray-500">프로필 변경</span>
                <Badge variant="secondary" className="text-xs">1건</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 팀원 현황 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-ctr-gray-700">
              <UserCheck className="mr-2 inline-block h-4 w-4" />
              팀원 현황
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-ctr-gray-500">전체 팀원</span>
                <span className="text-lg font-bold text-ctr-primary">
                  {summary?.teamCount ?? '-'}명
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-ctr-gray-500">신규 입사</span>
                <span className="text-sm font-medium text-green-600">2명</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-ctr-gray-500">수습 중</span>
                <span className="text-sm font-medium text-yellow-600">1명</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
