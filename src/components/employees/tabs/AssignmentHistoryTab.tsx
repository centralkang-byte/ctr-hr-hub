'use client'

import { useCallback, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AssignmentTimeline, type TimelineEvent } from '@/components/shared/AssignmentTimeline'
import { EffectiveDatePicker, buildDefaultQuickSelects } from '@/components/shared/EffectiveDatePicker'
import { apiClient } from '@/lib/api'
import { ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── Types ──────────────────────────────────────────────────

interface AssignmentRecord {
  id: string
  effectiveDate: string
  endDate: string | null
  changeType: string
  companyId: string
  employmentType: string
  contractType: string | null
  status: string
  reason: string | null
  orderNumber: string | null
  company: { id: string; name: string } | null
  department: { id: string; name: string } | null
  jobGrade: { id: string; name: string; code?: string } | null
  jobCategory: { id: string; name: string } | null
  approver: { id: string; name: string; photoUrl: string | null } | null
}

interface SnapshotData {
  date: string
  employee: { id: string; name: string }
  assignment: AssignmentRecord | null
}

interface AssignmentHistoryTabProps {
  employeeId: string
  hireDate: Date | string | null
  user: SessionUser
  onSnapshotChange?: (snapshot: SnapshotData | null) => void
}

// ─── 변경유형 한국어 레이블 ──────────────────────────────────

const CHANGE_TYPE_LABELS: Record<string, string> = {
  HIRE: '입사',
  PROMOTION: '승진',
  DEMOTION: '강등',
  TRANSFER: '부서이동',
  COMPANY_TRANSFER: '법인이동',
  CONTRACT_CHANGE: '계약변경',
  STATUS_CHANGE: '상태변경',
  REORGANIZATION: '조직개편',
  TERMINATION: '퇴직',
}

// ─── assignment → TimelineEvent 변환 ────────────────────────

function toTimelineEvent(a: AssignmentRecord, highlightDate: Date): TimelineEvent {
  const dept = a.department?.name ?? ''
  const grade = a.jobGrade?.name ?? ''
  const description = [dept, grade].filter(Boolean).join(' · ')

  const aDate = new Date(a.effectiveDate)
  const isHighlighted =
    aDate <= highlightDate &&
    (a.endDate === null || new Date(a.endDate) > highlightDate)

  return {
    id: a.id,
    date: a.effectiveDate,
    type: a.changeType,
    title: CHANGE_TYPE_LABELS[a.changeType] ?? a.changeType,
    description,
    details: a as unknown as Record<string, unknown>,
    highlighted: isHighlighted,
  }
}

// ─── SidePanel ──────────────────────────────────────────────

function AssignmentSidePanel({
  event,
  onClose,
}: {
  event: TimelineEvent
  onClose: () => void
}) {
  const a = event.details as unknown as AssignmentRecord

  const rows: Array<{ label: string; value: string }> = [
    { label: '발효일', value: new Date(a.effectiveDate).toLocaleDateString('ko-KR') },
    { label: '종료일', value: a.endDate ? new Date(a.endDate).toLocaleDateString('ko-KR') : '현재' },
    { label: '변경 유형', value: CHANGE_TYPE_LABELS[a.changeType] ?? a.changeType },
    { label: '법인', value: a.company?.name ?? '-' },
    { label: '부서', value: a.department?.name ?? '-' },
    { label: '직급', value: a.jobGrade?.name ?? '-' },
    { label: '직무', value: a.jobCategory?.name ?? '-' },
    { label: '고용형태', value: a.employmentType ?? '-' },
    { label: '계약유형', value: a.contractType ?? '-' },
    { label: '상태', value: a.status ?? '-' },
    { label: '발령번호', value: a.orderNumber ?? '-' },
    { label: '사유', value: a.reason ?? '-' },
    { label: '승인자', value: a.approver?.name ?? '-' },
  ]

  return (
    <div className="w-72 flex-shrink-0 rounded-xl border border-[#E8E8E8] bg-white overflow-hidden">
      <div className="flex items-center justify-between border-b border-[#E8E8E8] px-4 py-3">
        <h3 className="text-sm font-bold text-[#1A1A1A]">발령 상세</h3>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="p-4 space-y-2.5 overflow-y-auto max-h-96">
        <div className="flex items-center gap-2 pb-2 border-b border-[#F5F5F5]">
          <Badge variant="outline" className="text-xs">{event.title}</Badge>
          <span className="text-xs text-[#999]">{new Date(event.date).toLocaleDateString('ko-KR')}</span>
        </div>
        {rows.map((row) => (
          <div key={row.label} className="flex items-start gap-2">
            <span className="w-20 flex-shrink-0 text-xs text-[#999]">{row.label}</span>
            <span className="text-xs text-[#333] font-medium break-all">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────

export function AssignmentHistoryTab({
  employeeId,
  hireDate,
  user,
  onSnapshotChange,
}: AssignmentHistoryTabProps) {
  const isHrAdmin = user.role === ROLE.HR_ADMIN || user.role === ROLE.SUPER_ADMIN

  const [viewDate, setViewDate] = useState<Date>(new Date())
  const [assignments, setAssignments] = useState<AssignmentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null)
  const [snapshotLoading, setSnapshotLoading] = useState(false)

  // 이력 로드 (최초 1회)
  useEffect(() => {
    setLoading(true)
    apiClient
      .get<{ assignments: AssignmentRecord[]; hireDate: string | null }>(
        `/api/v1/employees/${employeeId}/history`
      )
      .then((res) => setAssignments(res.data.assignments))
      .catch(() => setAssignments([]))
      .finally(() => setLoading(false))
  }, [employeeId])

  // 시점 조회 — 날짜 변경 시 snapshot fetch
  const handleDateChange = useCallback(async (date: Date) => {
    if (!isHrAdmin && date > new Date()) {
      return
    }
    setViewDate(date)
    setSnapshotLoading(true)
    try {
      const dateStr = date.toISOString().slice(0, 10)
      const res = await apiClient.get<SnapshotData>(
        `/api/v1/employees/${employeeId}/snapshot?date=${dateStr}`
      )
      onSnapshotChange?.(res.data)
    } catch {
      onSnapshotChange?.(null)
    } finally {
      setSnapshotLoading(false)
    }
  }, [employeeId, isHrAdmin, onSnapshotChange])

  const events: TimelineEvent[] = assignments.map((a) =>
    toTimelineEvent(a, viewDate)
  )

  return (
    <div className="space-y-4">
      {/* 시점 조회 바 */}
      <EffectiveDatePicker
        value={viewDate}
        onChange={handleDateChange}
        allowFuture={isHrAdmin}
        employeeHireDate={hireDate}
        quickSelects={buildDefaultQuickSelects(hireDate)}
      />

      {/* 타임라인 + 사이드패널 */}
      <div className="flex gap-4">
        <div className="flex-1 min-w-0 rounded-xl border border-[#E8E8E8] bg-white p-6">
          <AssignmentTimeline
            events={events}
            onEventClick={setSelectedEvent}
            loading={loading}
            emptyMessage="발령 이력이 없습니다."
          />
        </div>

        {selectedEvent && (
          <AssignmentSidePanel
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
          />
        )}
      </div>

      {snapshotLoading && (
        <div className="text-xs text-[#999] text-center py-1 animate-pulse">시점 정보 조회 중...</div>
      )}
    </div>
  )
}
