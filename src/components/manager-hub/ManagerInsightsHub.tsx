'use client'

import { useState, useEffect } from 'react'
import {
  Users,
  AlertTriangle,
  Clock,
  MessageSquare,
  Loader2,
} from 'lucide-react'
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AiGeneratedBadge } from '@/components/shared/AiGeneratedBadge'
import { PageHeader } from '@/components/shared/PageHeader'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'

// ─── Types ──────────────────────────────────────────────

interface ManagerInsightsHubProps {
  user: SessionUser
}

interface Summary {
  headcount: number
  attritionRisk: number
  avgOvertimeHours: number
  incompleteOneOnOnes: number
}

interface HealthDimension {
  name: string
  value: number
  fullMark: number
}

interface Alert {
  id: string
  type: string
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  employeeName: string
  employeeId: string
  message: string
}

interface Performance {
  cycleId: string | null
  cycleName: string | null
  gradeDistribution: { grade: string; count: number }[]
  mboAchievement: { average: number; count: number }
}

// ─── Component ──────────────────────────────────────────

export function ManagerInsightsHub({ user }: ManagerInsightsHubProps) {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [health, setHealth] = useState<HealthDimension[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [performance, setPerformance] = useState<Performance | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      apiClient.get<Summary>('/api/v1/manager-hub/summary'),
      apiClient.get<{ dimensions: HealthDimension[] }>(
        '/api/v1/manager-hub/team-health',
      ),
      apiClient.get<Alert[]>('/api/v1/manager-hub/alerts'),
      apiClient.get<Performance>('/api/v1/manager-hub/performance'),
    ])
      .then(([s, h, a, p]) => {
        setSummary(s.data)
        setHealth(h.data.dimensions)
        setAlerts(a.data)
        setPerformance(p.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-ctr-primary" />
      </div>
    )
  }

  const kpis = [
    {
      label: '팀원 수',
      value: summary?.headcount ?? 0,
      icon: Users,
      color: 'text-ctr-primary',
      bgColor: 'bg-blue-50',
    },
    {
      label: '이직 위험',
      value: summary?.attritionRisk ?? 0,
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      suffix: '명',
    },
    {
      label: '평균 초과근무',
      value: summary?.avgOvertimeHours ?? 0,
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      suffix: 'h',
    },
    {
      label: '1:1 미완료',
      value: summary?.incompleteOneOnOnes ?? 0,
      icon: MessageSquare,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      suffix: '건',
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="매니저 허브" description="팀 현황을 한눈에 확인하세요." />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-ctr-gray-500">
                    {kpi.label}
                  </p>
                  <p className="text-2xl font-bold text-ctr-gray-900">
                    {kpi.value}
                    {kpi.suffix && (
                      <span className="ml-0.5 text-sm font-normal text-ctr-gray-500">
                        {kpi.suffix}
                      </span>
                    )}
                  </p>
                </div>
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full ${kpi.bgColor}`}
                >
                  <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Row 2: Radar Chart + Alerts */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Team Health Radar */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-ctr-gray-700">
              팀 건강 지표
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={health}>
                <PolarGrid />
                <PolarAngleAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: '#64748B' }}
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 100]}
                  tick={{ fontSize: 10 }}
                />
                <Radar
                  name="팀"
                  dataKey="value"
                  stroke="#2563EB"
                  fill="#2563EB"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Alerts */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-ctr-gray-700">
              <AlertTriangle className="mr-2 inline-block h-4 w-4" />
              팀 알림
            </CardTitle>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <p className="py-4 text-center text-sm text-ctr-gray-500">
                현재 알림이 없습니다.
              </p>
            ) : (
              <div className="space-y-2">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`rounded-lg border p-3 ${
                      alert.severity === 'HIGH'
                        ? 'border-red-200 bg-red-50'
                        : alert.severity === 'MEDIUM'
                          ? 'border-amber-200 bg-amber-50'
                          : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p
                        className={`text-sm font-medium ${
                          alert.severity === 'HIGH'
                            ? 'text-red-800'
                            : alert.severity === 'MEDIUM'
                              ? 'text-amber-800'
                              : 'text-slate-700'
                        }`}
                      >
                        {alert.employeeName}
                      </p>
                      <Badge
                        variant={
                          alert.severity === 'HIGH'
                            ? 'destructive'
                            : 'secondary'
                        }
                        className="text-xs"
                      >
                        {alert.type === 'OVERTIME'
                          ? '초과근무'
                          : alert.type === 'BURNOUT'
                            ? '번아웃'
                            : '이탈위험'}
                      </Badge>
                    </div>
                    <p
                      className={`mt-1 text-xs ${
                        alert.severity === 'HIGH'
                          ? 'text-red-700'
                          : alert.severity === 'MEDIUM'
                            ? 'text-amber-700'
                            : 'text-slate-500'
                      }`}
                    >
                      {alert.message}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Performance + AI Recommendation */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Grade Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-ctr-gray-700">
              성과 등급 분포
              {performance?.cycleName && (
                <span className="ml-2 text-xs font-normal text-ctr-gray-500">
                  {performance.cycleName}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {performance?.gradeDistribution &&
            performance.gradeDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={performance.gradeDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="grade" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar
                    dataKey="count"
                    fill="#2563EB"
                    radius={[4, 4, 0, 0]}
                    name="인원"
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-8 text-center text-sm text-ctr-gray-500">
                평가 데이터가 없습니다.
              </p>
            )}
            {performance?.mboAchievement && (
              <div className="mt-3 flex items-center justify-between border-t pt-3">
                <span className="text-sm text-ctr-gray-500">
                  MBO 평균 달성률
                </span>
                <span className="text-lg font-bold text-ctr-primary">
                  {performance.mboAchievement.average}%
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Recommendation */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-ctr-gray-700">
              AI 추천
            </CardTitle>
            <AiGeneratedBadge />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(summary?.incompleteOneOnOnes ?? 0) > 0 && (
                <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
                  <p className="text-sm font-medium text-purple-800">
                    1:1 미팅 진행 필요
                  </p>
                  <p className="mt-1 text-xs text-purple-700">
                    이번 달 {summary?.incompleteOneOnOnes}건의 1:1 미팅이 미완료
                    상태입니다. 팀원과의 소통을 위해 일정을 확인하세요.
                  </p>
                </div>
              )}
              {(summary?.avgOvertimeHours ?? 0) > 5 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm font-medium text-amber-800">
                    초과근무 관리 필요
                  </p>
                  <p className="mt-1 text-xs text-amber-700">
                    팀 평균 초과근무가 {summary?.avgOvertimeHours}시간으로
                    높은 편입니다. 업무 분배를 재검토하세요.
                  </p>
                </div>
              )}
              {(summary?.attritionRisk ?? 0) > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-sm font-medium text-red-800">
                    이직 위험 팀원 관리
                  </p>
                  <p className="mt-1 text-xs text-red-700">
                    {summary?.attritionRisk}명의 팀원이 이직 위험으로
                    분류되었습니다. 개별 면담을 권장합니다.
                  </p>
                </div>
              )}
              {(summary?.incompleteOneOnOnes ?? 0) === 0 &&
                (summary?.avgOvertimeHours ?? 0) <= 5 &&
                (summary?.attritionRisk ?? 0) === 0 && (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                    <p className="text-sm font-medium text-green-800">
                      우수한 팀 관리
                    </p>
                    <p className="mt-1 text-xs text-green-700">
                      팀 건강 지표가 양호합니다. 현재의 관리 수준을 유지하세요.
                    </p>
                  </div>
                )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
