'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 매니저 허브 (5-tab IA)
// 프로토 page-team-hub 정합: 개요 / 팀원 / 1:1·활동 / 성과 / AI.
// 개요·성과·AI = 기존 엔드포인트(summary·team-health·performance) 재배치,
// 팀원 = /manager-hub/members 로스터, 1:1·활동 = PR-2(준비중).
// 헤더 액션: 팀 공지(알림 발송)·1:1 예약(WdDrawer).
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Users,
  AlertTriangle,
  Clock,
  MessageSquare,
  Loader2,
  LayoutGrid,
  Inbox,
  Trophy,
  Sparkles,
  Mail,
  Calendar,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AiGeneratedBadge } from '@/components/shared/AiGeneratedBadge'
import { PageHeader } from '@/components/shared/PageHeader'
import { apiClient } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { DottedLineReportsCard } from '@/components/manager-hub/DottedLineReportsCard'
import { TeamMembersTab, type ManagerHubMember } from '@/components/manager-hub/TeamMembersTab'
import { TeamActivityTab, type ManagerHubActivity } from '@/components/manager-hub/TeamActivityTab'
import { OneOnOneScheduleDrawer } from '@/components/manager-hub/OneOnOneScheduleDrawer'
import { TeamAnnounceDrawer } from '@/components/manager-hub/TeamAnnounceDrawer'
import type { SessionUser } from '@/types'

// ─── Types ──────────────────────────────────────────────────

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

// ─── Constants ──────────────────────────────────────────────

const RISK_VARIANT: Record<ManagerHubMember['riskBand'], 'success' | 'warning' | 'destructive'> = {
  LOW: 'success',
  MEDIUM: 'warning',
  HIGH: 'destructive',
}
const RISK_LABEL: Record<ManagerHubMember['riskBand'], string> = {
  LOW: '낮음',
  MEDIUM: '주의',
  HIGH: '높음',
}

// ─── Component ──────────────────────────────────────────────

export function ManagerInsightsHub({ user: _user }: ManagerInsightsHubProps) {
  const { toast } = useToast()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [health, setHealth] = useState<HealthDimension[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [performance, setPerformance] = useState<Performance | null>(null)
  const [members, setMembers] = useState<ManagerHubMember[]>([])
  const [activity, setActivity] = useState<ManagerHubActivity | null>(null)
  const [activityLoading, setActivityLoading] = useState(false)
  const [activityLoaded, setActivityLoaded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [membersLoading, setMembersLoading] = useState(true)
  const [tab, setTab] = useState('overview')

  const [announceOpen, setAnnounceOpen] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [scheduleFor, setScheduleFor] = useState<string | undefined>(undefined)

  const loadCore = useCallback(() => {
    setLoading(true)
    Promise.all([
      apiClient.get<Summary>('/api/v1/manager-hub/summary'),
      apiClient.get<{ dimensions: HealthDimension[] }>('/api/v1/manager-hub/team-health'),
      apiClient.get<Alert[]>('/api/v1/manager-hub/alerts'),
      apiClient.get<Performance>('/api/v1/manager-hub/performance'),
    ])
      .then(([s, h, a, p]) => {
        setSummary(s.data)
        setHealth(h.data.dimensions)
        setAlerts(a.data)
        setPerformance(p.data)
      })
      .catch(() => {
        toast({ title: '팀 현황 로드 실패', variant: 'destructive' })
      })
      .finally(() => setLoading(false))
  }, [toast])

  const loadMembers = useCallback(() => {
    setMembersLoading(true)
    apiClient
      .get<{ members: ManagerHubMember[] }>('/api/v1/manager-hub/members')
      .then((r) => setMembers(r.data.members ?? []))
      .catch(() => {
        toast({ title: '팀원 로드 실패', variant: 'destructive' })
      })
      .finally(() => setMembersLoading(false))
  }, [toast])

  // 활동 탭은 무거우니 첫 진입 시 지연 로드 (open 안 하면 호출 안 함).
  // seq ref = 최신 요청만 상태에 반영(예약 후 갱신과 최초 로드 경합 시 stale 덮어쓰기 방지).
  // activityLoaded 는 성공 시에만 true → 실패하면 재진입으로 재시도 가능.
  const activitySeqRef = useRef(0)
  const loadActivity = useCallback(() => {
    const seq = ++activitySeqRef.current
    setActivityLoading(true)
    apiClient
      .get<ManagerHubActivity>('/api/v1/manager-hub/activity')
      .then((r) => {
        if (seq !== activitySeqRef.current) return
        setActivity(r.data)
        setActivityLoaded(true)
      })
      .catch(() => {
        if (seq !== activitySeqRef.current) return
        toast({ title: '활동 로드 실패', variant: 'destructive' })
      })
      .finally(() => {
        if (seq === activitySeqRef.current) setActivityLoading(false)
      })
  }, [toast])

  useEffect(() => {
    loadCore()
    loadMembers()
  }, [loadCore, loadMembers])

  const handleSchedule = (member: ManagerHubMember) => {
    setScheduleFor(member.id)
    setScheduleOpen(true)
  }

  const afterScheduled = () => {
    loadCore()
    loadMembers()
    // 활동 탭이 이미 열렸거나(loaded) 최초 로드 중(loading)이면 갱신 —
    // loadActivity 가 seq 를 올려 진행 중이던 stale 요청을 폐기시킴(예약 직후 경합 차단).
    if (activityLoaded || activityLoading) loadActivity()
  }

  // AI 추천 — summary 임계 기반 클라 파생 (기존 동작 보존, 개요·AI 탭 공용)
  const aiRecommendations = () => {
    const cards: { tone: string; title: string; body: string }[] = []
    if ((summary?.incompleteOneOnOnes ?? 0) > 0) {
      cards.push({
        tone: 'border-wt-4/20 bg-wt-4/10 text-wt-4',
        title: '1:1 미팅 진행 필요',
        body: `이번 달 ${summary?.incompleteOneOnOnes}건의 1:1 미팅이 미완료 상태입니다. 팀원과의 소통을 위해 일정을 확인하세요.`,
      })
    }
    if ((summary?.avgOvertimeHours ?? 0) > 5) {
      cards.push({
        tone: 'border-amber-300 bg-amber-500/15 text-amber-800',
        title: '초과근무 관리 필요',
        body: `팀 평균 초과근무가 ${summary?.avgOvertimeHours}시간으로 높은 편입니다. 업무 분배를 재검토하세요.`,
      })
    }
    if ((summary?.attritionRisk ?? 0) > 0) {
      cards.push({
        tone: 'border-destructive/20 bg-destructive/10 text-destructive',
        title: '이직 위험 팀원 관리',
        body: `${summary?.attritionRisk}명의 팀원이 이직 위험으로 분류되었습니다. 개별 면담을 권장합니다.`,
      })
    }
    if (cards.length === 0) {
      cards.push({
        tone: 'border-tertiary/20 bg-tertiary-container/10 text-tertiary',
        title: '우수한 팀 관리',
        body: '팀 건강 지표가 양호합니다. 현재의 관리 수준을 유지하세요.',
      })
    }
    return cards
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-ctr-primary" />
      </div>
    )
  }

  const kpis = [
    { label: '팀원 수', value: summary?.headcount ?? 0, icon: Users, color: 'text-ctr-primary', bgColor: 'bg-primary/10' },
    { label: '이직 위험', value: summary?.attritionRisk ?? 0, icon: AlertTriangle, color: 'text-destructive', bgColor: 'bg-destructive/10', suffix: '명' },
    { label: '평균 초과근무', value: summary?.avgOvertimeHours ?? 0, icon: Clock, color: 'text-yellow-600', bgColor: 'bg-yellow-500/10', suffix: 'h' },
    { label: '1:1 미완료', value: summary?.incompleteOneOnOnes ?? 0, icon: MessageSquare, color: 'text-wt-4', bgColor: 'bg-wt-4/10', suffix: '건' },
  ]

  const memberOptions = members.map((m) => ({ id: m.id, name: m.name }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="매니저 허브"
        description="팀 현황을 한눈에 확인하고 매니저 액션을 실행해요."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setAnnounceOpen(true)}>
              <Mail className="mr-1.5 h-4 w-4" />
              팀 공지
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setScheduleFor(undefined)
                setScheduleOpen(true)
              }}
            >
              <Calendar className="mr-1.5 h-4 w-4" />
              1:1 예약
            </Button>
          </>
        }
      />

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v)
          if (v === 'activity' && !activityLoaded && !activityLoading) loadActivity()
        }}
      >
        <TabsList aria-label="매니저 허브 탭">
          <TabsTrigger value="overview">
            <LayoutGrid className="mr-1.5 h-4 w-4" />
            개요
          </TabsTrigger>
          <TabsTrigger value="members">
            <Users className="mr-1.5 h-4 w-4" />
            팀원 ({summary?.headcount ?? 0})
          </TabsTrigger>
          <TabsTrigger value="activity">
            <Inbox className="mr-1.5 h-4 w-4" />
            1:1 · 활동
          </TabsTrigger>
          <TabsTrigger value="perf">
            <Trophy className="mr-1.5 h-4 w-4" />
            성과
          </TabsTrigger>
          <TabsTrigger value="ai">
            <Sparkles className="mr-1.5 h-4 w-4" />
            AI 추천
          </TabsTrigger>
        </TabsList>

        {/* ── 개요 ── */}
        <TabsContent value="overview" className="mt-4 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {kpis.map((kpi) => (
              <Card key={kpi.label}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{kpi.label}</p>
                      <p className="text-2xl font-bold text-foreground">
                        {kpi.value}
                        {kpi.suffix && (
                          <span className="ml-0.5 text-sm font-normal text-muted-foreground">
                            {kpi.suffix}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${kpi.bgColor}`}>
                      <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-foreground">팀 건강 지표</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={health}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748B' }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Radar name="팀" dataKey="value" stroke="#004964" fill="#004964" fillOpacity={0.2} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-foreground">AI 추천</CardTitle>
                <AiGeneratedBadge />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {aiRecommendations().map((rec) => (
                    <div key={rec.title} className={`rounded-lg border p-3 ${rec.tone}`}>
                      <p className="text-sm font-medium">{rec.title}</p>
                      <p className="mt-1 text-xs">{rec.body}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 팀 알림 (keep-live: 프로토 미존재이나 실데이터 보존) */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-foreground">
                <AlertTriangle className="mr-2 inline-block h-4 w-4" />
                팀 알림
              </CardTitle>
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">현재 알림이 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`rounded-lg border p-3 ${
                        alert.severity === 'HIGH'
                          ? 'border-destructive/20 bg-destructive/10'
                          : alert.severity === 'MEDIUM'
                            ? 'border-amber-300 bg-amber-500/15'
                            : 'border-border bg-background'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p
                          className={`text-sm font-medium ${
                            alert.severity === 'HIGH'
                              ? 'text-destructive'
                              : alert.severity === 'MEDIUM'
                                ? 'text-amber-800'
                                : 'text-foreground'
                          }`}
                        >
                          {alert.employeeName}
                        </p>
                        <Badge variant={alert.severity === 'HIGH' ? 'destructive' : 'secondary'} className="text-xs">
                          {alert.type === 'OVERTIME' ? '초과근무' : alert.type === 'BURNOUT' ? '번아웃' : '이탈위험'}
                        </Badge>
                      </div>
                      <p
                        className={`mt-1 text-xs ${
                          alert.severity === 'HIGH'
                            ? 'text-destructive'
                            : alert.severity === 'MEDIUM'
                              ? 'text-amber-700'
                              : 'text-muted-foreground'
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

          {/* 팀원 현황 미리보기 */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">팀원 현황</h3>
              <Button variant="ghost" size="sm" onClick={() => setTab('members')}>
                전체 보기 →
              </Button>
            </div>
            {membersLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-ctr-primary" />
              </div>
            ) : members.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">직속 팀원이 없습니다.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {members.slice(0, 8).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleSchedule(m)}
                    className="rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-foreground">{m.name}</span>
                      {m.riskBand !== 'LOW' && (
                        <Badge variant={RISK_VARIANT[m.riskBand]} className="shrink-0 text-[10px]">
                          {RISK_LABEL[m.riskBand]}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {m.positionTitle || m.departmentName || '—'}
                    </div>
                    <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
                      <span>
                        초과근무{' '}
                        <b className="tabular-nums text-foreground">
                          {Math.round((m.overtimeMinutesMonth / 60) * 10) / 10}h
                        </b>
                      </span>
                      <span>
                        연차{' '}
                        <b className="tabular-nums text-foreground">
                          {m.leaveUsagePct === null ? '—' : `${m.leaveUsagePct}%`}
                        </b>
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── 팀원 ── */}
        <TabsContent value="members" className="mt-4 space-y-6">
          <TeamMembersTab members={members} loading={membersLoading} onSchedule={handleSchedule} />
          <DottedLineReportsCard />
        </TabsContent>

        {/* ── 1:1 · 활동 ── */}
        <TabsContent value="activity" className="mt-4">
          <TeamActivityTab
            data={activity}
            loading={activityLoading}
            onSchedule={() => {
              setScheduleFor(undefined)
              setScheduleOpen(true)
            }}
          />
        </TabsContent>

        {/* ── 성과 ── */}
        <TabsContent value="perf" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-foreground">
                성과 등급 분포
                {performance?.cycleName && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {performance.cycleName}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {performance?.gradeDistribution && performance.gradeDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={performance.gradeDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="grade" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#004964" radius={[4, 4, 0, 0]} name="인원" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">평가 데이터가 없습니다.</p>
              )}
              {performance?.mboAchievement && (
                <div className="mt-3 flex items-center justify-between border-t pt-3">
                  <span className="text-sm text-muted-foreground">MBO 평균 달성률</span>
                  <span className="text-lg font-bold text-ctr-primary">
                    {performance.mboAchievement.average}%
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── AI 추천 ── */}
        <TabsContent value="ai" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-foreground">AI 인사이트</CardTitle>
              <AiGeneratedBadge />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {aiRecommendations().map((rec) => (
                  <div key={rec.title} className={`rounded-lg border p-3 ${rec.tone}`}>
                    <p className="text-sm font-medium">{rec.title}</p>
                    <p className="mt-1 text-xs">{rec.body}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                AI 추천은 팀의 근태 · 성과 · 1:1 미팅 데이터를 기반으로 자동 생성돼요. 결정 참고용으로만
                사용하세요.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <OneOnOneScheduleDrawer
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        members={memberOptions}
        defaultEmployeeId={scheduleFor}
        onScheduled={afterScheduled}
      />
      <TeamAnnounceDrawer
        open={announceOpen}
        onClose={() => setAnnounceOpen(false)}
        teamCount={summary?.headcount ?? 0}
      />
    </div>
  )
}
