'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Attendance Team Client
// 팀 근태 현황: 출근/미출근/지각 요약 + 팀원 목록
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { apiClient } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import type { DataTableColumn } from '@/components/shared/DataTable'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ko } from '@/lib/i18n/ko'
import type { SessionUser } from '@/types'

// ─── Types ──────────────────────────────────────────────────

interface MemberAttendance {
  clockIn: string | null
  clockOut: string | null
  status: string
  workType: string
  totalMinutes: number
}

interface TeamMember {
  employeeId: string
  employeeNo: string
  name: string
  position: string
  attendance: MemberAttendance | null
  isClockedIn: boolean
}

interface TeamAttendanceData {
  date: string
  members: TeamMember[]
}

// ─── Status label map ───────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  NORMAL: ko.attendance.normal,
  LATE: ko.attendance.late,
  EARLY_OUT: ko.attendance.earlyOut,
  ABSENT: ko.attendance.absent,
}

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  NORMAL: 'default',
  LATE: 'secondary',
  EARLY_OUT: 'outline',
  ABSENT: 'destructive',
}

// ─── Helpers ────────────────────────────────────────────────

function formatTime(t: string | null | undefined): string {
  if (!t) return '—'
  return new Date(t).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

// ─── Component ──────────────────────────────────────────────

export function AttendanceTeamClient({ user }: { user: SessionUser }) {
  void user

  const [data, setData] = useState<TeamAttendanceData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<TeamAttendanceData>('/api/v1/attendance/team')
      setData(res.data)
    } catch {
      // TODO: error toast
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  // ─── Summary counts ───

  const members = data?.members ?? []
  const presentCount = members.filter((m) => m.attendance !== null).length
  const absentCount = members.filter((m) => m.attendance === null).length
  const lateCount = members.filter((m) => m.attendance?.status === 'LATE').length

  // ─── Table columns ───

  const columns: DataTableColumn<TeamMember>[] = [
    { key: 'name', header: ko.employee.name },
    { key: 'employeeNo', header: ko.employee.employeeCode },
    { key: 'position', header: ko.employee.position },
    {
      key: 'clockIn',
      header: ko.attendance.clockIn,
      render: (row) => formatTime(row.attendance?.clockIn),
    },
    {
      key: 'clockOut',
      header: ko.attendance.clockOut,
      render: (row) => formatTime(row.attendance?.clockOut),
    },
    {
      key: 'status',
      header: ko.attendance.status,
      render: (row) => {
        if (!row.attendance) {
          return (
            <Badge variant="destructive">{ko.attendance.notClockedIn}</Badge>
          )
        }
        const status = row.attendance.status
        return (
          <Badge variant={STATUS_VARIANTS[status] ?? 'outline'}>
            {STATUS_LABELS[status] ?? status}
          </Badge>
        )
      },
    },
    {
      key: 'workType',
      header: ko.attendance.workType,
      render: (row) => row.attendance?.workType ?? '—',
    },
  ]

  // ─── Render ───

  return (
    <div className="space-y-6">
      <PageHeader title={ko.attendance.teamAttendance} />

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {ko.attendance.clockIn}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{presentCount}</p>
          </CardContent>
        </Card>

        <Card className="bg-amber-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {ko.attendance.notClockedIn}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{absentCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {ko.attendance.late}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{lateCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Team member table */}
      <DataTable
        columns={columns as unknown as DataTableColumn<Record<string, unknown>>[]}
        data={members as unknown as Record<string, unknown>[]}
        loading={loading}
        rowKey={(row) => (row as unknown as TeamMember).employeeId}
        emptyMessage={ko.common.noData}
      />
    </div>
  )
}
