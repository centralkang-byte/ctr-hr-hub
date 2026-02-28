'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Employee Home
// 직원 역할 대시보드 (Task-centric)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import {
  Clock,
  CalendarDays,
  Award,
  ClipboardList,
  Megaphone,
  CheckCircle2,
  LogIn,
  LogOut,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PendingActionsPanel } from './PendingActionsPanel'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'

// ─── Props ────────────────────────────────────────────────

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
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-ctr-gray-900">
          안녕하세요, {user.name}님
        </h1>
        <p className="mt-1 text-sm text-ctr-gray-500">
          오늘도 좋은 하루 되세요.
        </p>
      </div>

      {/* Pending Actions */}
      <PendingActionsPanel user={user} />

      {/* Dashboard Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* 출퇴근 */}
        <Card className="border-l-4 border-l-ctr-primary">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-ctr-gray-700">
              <Clock className="mr-2 inline-block h-4 w-4" />
              출퇴근
            </CardTitle>
            <Badge variant="secondary" className="text-xs">
              미출근
            </Badge>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-ctr-gray-500">
              오늘 근무 기록이 없습니다.
            </p>
            <div className="flex gap-2">
              <Button size="sm" className="bg-ctr-primary hover:bg-ctr-primary/90">
                <LogIn className="mr-1 h-4 w-4" />
                출근
              </Button>
              <Button size="sm" variant="outline" disabled>
                <LogOut className="mr-1 h-4 w-4" />
                퇴근
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 내 휴가 잔여 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-ctr-gray-700">
              <CalendarDays className="mr-2 inline-block h-4 w-4" />
              내 휴가 잔여
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-ctr-gray-500">연차</span>
                <span className="text-lg font-bold text-ctr-primary">
                  {annualLeave ? `${annualLeave.remaining}일` : '-'}
                </span>
              </div>
              {annualLeave && (
                <>
                  <div className="h-2 w-full rounded-full bg-ctr-gray-100">
                    <div
                      className="h-2 rounded-full bg-ctr-primary"
                      style={{
                        width: `${annualLeave.total > 0 ? (annualLeave.remaining / annualLeave.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-ctr-gray-500">
                    {annualLeave.total}일 중 {annualLeave.remaining}일 남음
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 최근 받은 칭찬 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-ctr-gray-700">
              <Award className="mr-2 inline-block h-4 w-4" />
              최근 받은 칭찬
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="rounded-lg bg-ctr-gray-50 p-3">
                <p className="text-sm font-medium text-ctr-gray-700">
                  &quot;프로젝트 기여에 감사합니다!&quot;
                </p>
                <p className="mt-1 text-xs text-ctr-gray-500">
                  김팀장 · 도전
                </p>
              </div>
              <div className="rounded-lg bg-ctr-gray-50 p-3">
                <p className="text-sm font-medium text-ctr-gray-700">
                  &quot;꼼꼼한 리뷰 감사합니다&quot;
                </p>
                <p className="mt-1 text-xs text-ctr-gray-500">
                  박과장 · 신뢰
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 온보딩 진행률 (신입 시) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-ctr-gray-700">
              <CheckCircle2 className="mr-2 inline-block h-4 w-4" />
              온보딩 진행률
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-ctr-gray-500">진행률</span>
                <span className="text-sm font-bold text-ctr-primary">75%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-ctr-gray-100">
                <div
                  className="h-2 rounded-full bg-green-500"
                  style={{ width: '75%' }}
                />
              </div>
              <p className="text-xs text-ctr-gray-500">
                12개 중 9개 완료
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 오늘 할 일 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-ctr-gray-700">
              <ClipboardList className="mr-2 inline-block h-4 w-4" />
              오늘 할 일
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-sm text-ctr-gray-700">
                <span className="h-2 w-2 rounded-full bg-ctr-accent" />
                MBO 목표 설정 마감 (D-3)
              </li>
              <li className="flex items-center gap-2 text-sm text-ctr-gray-700">
                <span className="h-2 w-2 rounded-full bg-yellow-500" />
                필수 교육 수강
              </li>
              <li className="flex items-center gap-2 text-sm text-ctr-gray-500 line-through">
                <span className="h-2 w-2 rounded-full bg-ctr-gray-300" />
                프로필 정보 업데이트
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* 공지사항 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-ctr-gray-700">
              <Megaphone className="mr-2 inline-block h-4 w-4" />
              공지사항
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              <li className="text-sm">
                <span className="font-medium text-ctr-gray-700">
                  2026년 상반기 성과 평가 안내
                </span>
                <p className="text-xs text-ctr-gray-500">2026-02-25</p>
              </li>
              <li className="text-sm">
                <span className="font-medium text-ctr-gray-700">
                  사내 카페테리아 메뉴 변경
                </span>
                <p className="text-xs text-ctr-gray-500">2026-02-24</p>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
