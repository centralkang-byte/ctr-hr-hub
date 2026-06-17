'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 팀원 로스터 탭 (매니저 허브)
// GET /api/v1/manager-hub/members 소비. 이름·초과근무·연차사용률·
// 성과등급(공개분)·이직위험·오늘 상태 + 1:1 예약 액션.
// ═══════════════════════════════════════════════════════════

import { Calendar, Loader2, Star } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

// ─── Types ──────────────────────────────────────────────────

export interface ManagerHubMember {
  id: string
  name: string
  positionTitle: string
  departmentName: string
  overtimeMinutesMonth: number
  leaveUsagePct: number | null
  performanceGrade: string | null
  riskBand: 'LOW' | 'MEDIUM' | 'HIGH'
  attritionRiskScore: number
  isHighPotential: boolean
  status: 'PRESENT' | 'LEAVE' | 'HALF_DAY' | 'VACATION' | 'ABSENT'
}

interface Props {
  members: ManagerHubMember[]
  loading: boolean
  onSchedule: (member: ManagerHubMember) => void
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

const STATUS_META: Record<
  ManagerHubMember['status'],
  { label: string; dot: string }
> = {
  PRESENT: { label: '근무', dot: 'bg-tertiary' },
  HALF_DAY: { label: '반차', dot: 'bg-warning-bright' },
  LEAVE: { label: '휴가', dot: 'bg-info' },
  VACATION: { label: '휴가', dot: 'bg-info' },
  ABSENT: { label: '미출근', dot: 'bg-muted-foreground' },
}

// ─── Helpers ────────────────────────────────────────────────

function overtimeHours(minutes: number): string {
  return (Math.round((minutes / 60) * 10) / 10).toString()
}

// ─── Component ──────────────────────────────────────────────

export function TeamMembersTab({ members, loading, onSchedule }: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-ctr-primary" />
      </div>
    )
  }

  if (members.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          직속 팀원이 없습니다.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">이름</th>
                <th className="px-4 py-3 text-right font-medium">초과근무</th>
                <th className="px-4 py-3 text-right font-medium">연차사용률</th>
                <th className="px-4 py-3 font-medium">성과등급</th>
                <th className="px-4 py-3 font-medium">이직위험</th>
                <th className="px-4 py-3 font-medium">상태</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const status = STATUS_META[m.status]
                return (
                  <tr key={m.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3" data-label="이름">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{m.name}</span>
                        {m.isHighPotential && (
                          <Star
                            className="h-3.5 w-3.5 fill-warning-bright text-warning-bright"
                            aria-label="핵심 인재"
                          />
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {m.positionTitle || m.departmentName || '—'}
                      </div>
                    </td>
                    <td
                      className="px-4 py-3 text-right tabular-nums text-foreground"
                      data-label="초과근무"
                    >
                      {overtimeHours(m.overtimeMinutesMonth)}h
                    </td>
                    <td
                      className="px-4 py-3 text-right tabular-nums text-foreground"
                      data-label="연차사용률"
                    >
                      {m.leaveUsagePct === null ? '—' : `${m.leaveUsagePct}%`}
                    </td>
                    <td className="px-4 py-3" data-label="성과등급">
                      {m.performanceGrade ? (
                        <span className="font-medium text-foreground">{m.performanceGrade}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">미공개</span>
                      )}
                    </td>
                    <td className="px-4 py-3" data-label="이직위험">
                      <Badge variant={RISK_VARIANT[m.riskBand]}>{RISK_LABEL[m.riskBand]}</Badge>
                    </td>
                    <td className="px-4 py-3" data-label="상태">
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`inline-block h-2 w-2 rounded-full ${status.dot}`} />
                        <span className="text-foreground">{status.label}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right" data-label="">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onSchedule(m)}
                        aria-label={`${m.name} 1:1 예약`}
                      >
                        <Calendar className="mr-1 h-3.5 w-3.5" />
                        1:1
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
