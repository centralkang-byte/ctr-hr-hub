'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Manager-Hub "1:1 · 활동" 탭 (PR-2)
// 상태칩 + 다가오는 1:1 + 보낸 칭찬 + 팀 주간일정(휴가) + 위임 현황.
// 데이터는 부모(ManagerInsightsHub)가 /manager-hub/activity 로 받아 props 전달
// (TeamMembersTab 과 동일한 presentation-only 패턴).
// ═══════════════════════════════════════════════════════════

import Link from 'next/link'
import { Heart, UserCheck, Loader2, Plus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDateTime, formatDate } from '@/lib/format/date'

// ─── Types ──────────────────────────────────────────────────

interface PersonRef {
  id: string
  name: string
}

interface ActivityOneOnOne {
  id: string
  employee: PersonRef
  scheduledAt: string
  meetingType: string
  agenda: string | null
}

interface ActivityRecognition {
  id: string
  receiver: PersonRef
  coreValue: string
  message: string
  createdAt: string
}

interface ActivityLeave {
  id: string
  employee: PersonRef
  startDate: string
  endDate: string
  days: number
  halfDayType: string | null
  leaveTypeName: string | null
}

interface ActivityDelegation {
  id: string
  delegatee: PersonRef
  scope: string
  startDate: string
  endDate: string
}

export interface ManagerHubActivity {
  /** 이번 주 월~금 'yyyy-MM-dd' (서버가 법인 tz 기준으로 계산 — 클라 tz 산식 없음) */
  weekDates: string[]
  oneOnOnes: ActivityOneOnOne[]
  recognitions: ActivityRecognition[]
  weeklyLeave: ActivityLeave[]
  delegations: ActivityDelegation[]
  counts: {
    upcomingOneOnOnes: number
    completedOneOnOnesQuarter: number
    sentRecognitionsQuarter: number
    activeDelegations: number
  }
}

interface Props {
  data: ManagerHubActivity | null
  loading: boolean
  onSchedule: () => void
}

// ─── Constants ──────────────────────────────────────────────

const MEETING_TYPE_LABELS: Record<string, string> = {
  REGULAR: '정기',
  AD_HOC: '수시',
  GOAL_REVIEW: '목표 점검',
  DEVELOPMENT: '성장/커리어',
}

// 칭찬 핵심가치 — RecognitionClient.tsx VALUE_LABELS 와 동일 표기
const VALUE_LABELS: Record<string, string> = {
  CHALLENGE: 'Challenge',
  TRUST: 'Trust',
  RESPONSIBILITY: 'Responsibility',
  RESPECT: 'Respect',
}

const SCOPE_LABELS: Record<string, string> = {
  LEAVE_ONLY: '휴가 결재',
  ALL: '전체 결재',
}

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'] as const

// ─── Helpers ────────────────────────────────────────────────

/** 'yyyy-MM-dd' → { 요일 라벨, "M/D" }. 달력일이라 UTC 파싱(브라우저 tz 무관). */
function dayMeta(dateStr: string): { weekday: string; md: string } {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return { weekday: WEEKDAY_KO[dow], md: `${m}/${d}` }
}

/** 휴가가 특정 달력일(문자열)을 덮는지 — 'yyyy-MM-dd' 사전식 비교(tz 무관). */
function coversDay(leave: ActivityLeave, dateStr: string): boolean {
  return leave.startDate <= dateStr && leave.endDate >= dateStr
}

function leaveTypeLabel(leave: ActivityLeave): string {
  if (leave.halfDayType) return '반차'
  return leave.leaveTypeName ?? '휴가'
}

/** 위임 만료 임박(D-2 이내) 여부. */
function isExpiringSoon(endDate: string): boolean {
  const days = (new Date(endDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
  return days >= 0 && days <= 2
}

// ─── Component ──────────────────────────────────────────────

export function TeamActivityTab({ data, loading, onSchedule }: Props) {
  if (loading) {
    return (
      <div role="status" className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-ctr-primary" />
        <span className="sr-only">활동 데이터를 불러오는 중</span>
      </div>
    )
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          활동 데이터를 불러오지 못했어요.
        </CardContent>
      </Card>
    )
  }

  const { oneOnOnes, recognitions, weeklyLeave, delegations, counts, weekDates } = data

  return (
    <div className="space-y-4">
      {/* ── 상태 칩 ── */}
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-foreground">
          <b className="font-semibold tabular-nums">{counts.upcomingOneOnOnes}</b>건 예정 1:1
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-foreground">
          <b className="font-semibold tabular-nums">{counts.completedOneOnOnesQuarter}</b>건 이번 분기 완료
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-foreground">
          <b className="font-semibold tabular-nums">{counts.sentRecognitionsQuarter}</b>건 보낸 칭찬
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-foreground">
          <b className="font-semibold tabular-nums">{counts.activeDelegations}</b>건 활성 위임
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── 다가오는 1:1 ── */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">다가오는 1:1 미팅</CardTitle>
            <Button size="sm" onClick={onSchedule}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              1:1 예약
            </Button>
          </CardHeader>
          <CardContent>
            {oneOnOnes.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">예정된 1:1 미팅이 없어요.</p>
            ) : (
              <div role="list" className="divide-y divide-border">
                {oneOnOnes.map((o) => (
                  <article
                    key={o.id}
                    role="listitem"
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{o.employee.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {o.agenda || MEETING_TYPE_LABELS[o.meetingType] || '1:1'}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                      {formatDateTime(o.scheduledAt)}
                    </span>
                  </article>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── 보낸 칭찬 ── */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">최근 보낸 칭찬</CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link href="/performance/recognition">
                <Heart className="mr-1 h-3.5 w-3.5" />
                칭찬 보내기
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recognitions.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">아직 보낸 칭찬이 없어요.</p>
            ) : (
              <div role="list" className="divide-y divide-border">
                {recognitions.map((r) => (
                  <article key={r.id} role="listitem" className="flex items-start justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">→ {r.receiver.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{r.message}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge variant="accent">{VALUE_LABELS[r.coreValue] ?? r.coreValue}</Badge>
                      <span className="text-[11px] text-muted-foreground">{formatDate(r.createdAt)}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── 팀 주간일정 (이번 주 휴가) ── */}
      <Card>
        <CardHeader className="space-y-0">
          <CardTitle className="text-base">팀 일정 (이번 주)</CardTitle>
          <p className="text-xs text-muted-foreground">승인된 휴가 · 반차</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-1.5">
            {weekDates.map((dateStr) => {
              const { weekday, md } = dayMeta(dateStr)
              const events = weeklyLeave.filter((l) => coversDay(l, dateStr))
              return (
                <div key={dateStr} className="min-h-[96px] rounded-lg bg-muted/40 p-2">
                  <p className="mb-2 text-[11px] font-semibold text-muted-foreground">
                    {weekday} {md}
                  </p>
                  {events.length === 0 ? (
                    <p className="mt-4 text-center text-[11px] text-muted-foreground/60">—</p>
                  ) : (
                    events.map((e) => (
                      <div key={e.id} className="mb-1 rounded-md bg-card px-2 py-1 text-[11px] shadow-sm">
                        <p className="truncate font-medium text-foreground">{e.employee.name}</p>
                        <p className="truncate text-[10px] text-muted-foreground">{leaveTypeLabel(e)}</p>
                      </div>
                    ))
                  )}
                </div>
              )
            })}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground/70">
            외근 · 출장은 현재 휴가 시스템 밖이라 표시되지 않아요.
          </p>
        </CardContent>
      </Card>

      {/* ── 위임 현황 ── */}
      <Card>
        <CardHeader className="space-y-0">
          <CardTitle className="text-base">내 업무 위임 현황</CardTitle>
          <p className="text-xs text-muted-foreground">진행 중 {delegations.length}건</p>
        </CardHeader>
        <CardContent>
          {delegations.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <UserCheck className="h-7 w-7 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">활성 위임이 없어요.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2 font-medium">위임 받은 사람</th>
                    <th className="py-2 font-medium">범위</th>
                    <th className="py-2 text-right font-medium">기간</th>
                    <th className="py-2 text-right font-medium">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {delegations.map((d) => (
                    <tr key={d.id} className="border-b border-border last:border-0">
                      <td data-label="위임 받은 사람" className="py-2.5 font-medium text-foreground">
                        {d.delegatee.name}
                      </td>
                      <td data-label="범위" className="py-2.5 text-muted-foreground">
                        {SCOPE_LABELS[d.scope] ?? d.scope}
                      </td>
                      <td
                        data-label="기간"
                        className="whitespace-nowrap py-2.5 text-right font-mono text-xs tabular-nums text-muted-foreground"
                      >
                        {formatDate(d.startDate)} ~ {formatDate(d.endDate)}
                      </td>
                      <td data-label="상태" className="py-2.5 text-right">
                        {isExpiringSoon(d.endDate) ? (
                          <Badge variant="warning">만료 임박</Badge>
                        ) : (
                          <Badge variant="success">진행 중</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
