'use client'

import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Attendance Team Client
// 팀 근태 현황: 출근/미출근/지각 요약 + 팀원 목록
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { apiClient } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import type { DataTableColumn } from '@/components/shared/DataTable'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { SessionUser } from '@/types'
import { TYPOGRAPHY } from '@/lib/styles'
import { STATUS_VARIANT } from '@/lib/styles/status'

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

// ─── Status variant map ─────────────────────────────────────

const STATUS_BADGE_STYLES: Record<string, string> = {
  NORMAL: STATUS_VARIANT.success,
  LATE: STATUS_VARIANT.error,
  EARLY_OUT: STATUS_VARIANT.warning,
  ABSENT: STATUS_VARIANT.error,
}

// ─── Helpers ────────────────────────────────────────────────

function formatTime(t: string | null | undefined): string {
  if (!t) return '—'
  return new Date(t).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

// ─── Component ──────────────────────────────────────────────

export function AttendanceTeamClient({ user }: { user: SessionUser }) {
  void user

  const t = useTranslations('attendance')
  const tc = useTranslations('common')
  const te = useTranslations('employee')

  const STATUS_LABELS: Record<string, string> = {
    NORMAL: t('normal'),
    LATE: t('late'),
    EARLY_OUT: t('earlyOut'),
    ABSENT: t('absent'),
  }

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
    { key: 'name', header: te('name') },
    { key: 'employeeNo', header: te('employeeCode') },
    { key: 'position', header: te('position') },
    {
      key: 'clockIn',
      header: t('clockIn'),
      render: (row) => formatTime(row.attendance?.clockIn),
    },
    {
      key: 'clockOut',
      header: t('clockOut'),
      render: (row) => formatTime(row.attendance?.clockOut),
    },
    {
      key: 'status',
      header: t('status'),
      render: (row) => {
        if (!row.attendance) {
          return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-[4px] text-xs font-semibold bg-[#FFEBEE] text-[#F44336]">{t('notClockedIn')}</span>
          )
        }
        const status = row.attendance.status
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-[4px] text-xs font-semibold ${STATUS_BADGE_STYLES[status] ?? STATUS_VARIANT.neutral}`}>
            {STATUS_LABELS[status] ?? status}
          </span>
        )
      },
    },
    {
      key: 'workType',
      header: t('workType'),
      render: (row) => row.attendance?.workType ?? '—',
    },
  ]

  // ─── Render ───

  return (
    <div className="space-y-6">
      <PageHeader title={t('teamAttendance')} />

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
          <p className="text-xs text-[#999] font-medium mb-2">{t('clockIn')}</p>
          <p className="text-3xl font-bold tabular-nums text-emerald-600"><AnimatedNumber value={presentCount} /></p>
        </div>

        <div className="bg-white border border-[#E8E8E8] rounded-xl p-6 border-l-4 border-l-[#FF9800]">
          <p className="text-xs text-[#999] font-medium mb-2">{t('notClockedIn')}</p>
          <p className="text-3xl font-bold tabular-nums text-amber-500"><AnimatedNumber value={absentCount} /></p>
        </div>

        <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
          <p className="text-xs text-[#999] font-medium mb-2">{t('late')}</p>
          <p className={`text-3xl font-bold tabular-nums ${lateCount > 0 ? 'text-[#F44336]' : 'text-[#1A1A1A]'}`}><AnimatedNumber value={lateCount} /></p>
        </div>
      </div>

      {/* Team member table */}
      <DataTable
        columns={columns as unknown as DataTableColumn<Record<string, unknown>>[]}
        data={members as unknown as Record<string, unknown>[]}
        loading={loading}
        rowKey={(row) => (row as unknown as TeamMember).employeeId}
        emptyMessage={tc('noData')}
      />
    </div>
  )
}
