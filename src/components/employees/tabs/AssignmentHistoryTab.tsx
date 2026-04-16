'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AssignmentTimeline, type TimelineEvent } from '@/components/shared/AssignmentTimeline'
import { EffectiveDatePicker, buildDefaultQuickSelects } from '@/components/shared/EffectiveDatePicker'
import AddConcurrentDialog from '@/components/employees/dialogs/AddConcurrentDialog'
import EndConcurrentDialog from '@/components/employees/dialogs/EndConcurrentDialog'
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
  position: { id: string; titleKo: string; titleEn: string | null } | null
  approver: { id: string; name: string; photoUrl: string | null } | null
  isPrimary: boolean
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
  HIRE: 'assignmentTypeHire',
  PROMOTION: 'assignmentTypePromotion',
  DEMOTION: 'assignmentTypeDemotion',
  TRANSFER: 'assignmentTypeTransfer',
  COMPANY_TRANSFER: 'assignmentTypeCompanyTransfer',
  CONTRACT_CHANGE: 'assignmentTypeContractChange',
  STATUS_CHANGE: 'assignmentTypeStatusChange',
  REORGANIZATION: 'assignmentTypeReorganization',
  TERMINATION: 'assignmentTypeTermination',
  CONCURRENT: 'assignmentTypeConcurrent',
}

// ─── assignment → TimelineEvent 변환 ────────────────────────

function toTimelineEvent(a: AssignmentRecord, highlightDate: Date, t: (key: string, params?: Record<string, string | number | Date>) => string): TimelineEvent {
  const dept = a.department?.name ?? ''
  const grade = a.jobGrade?.name ?? ''
  const description = [dept, grade].filter(Boolean).join(' · ')

  const aDate = new Date(a.effectiveDate)
  const isHighlighted =
    aDate <= highlightDate &&
    (a.endDate === null || new Date(a.endDate) > highlightDate)

  const prefix = a.isPrimary !== false ? t('assignmentPrefixPrimary') + ' ' : t('assignmentPrefixConcurrent') + ' '

  return {
    id: a.id,
    date: a.effectiveDate,
    type: a.changeType,
    title: prefix + (CHANGE_TYPE_LABELS[a.changeType] ? t(CHANGE_TYPE_LABELS[a.changeType]) : a.changeType),
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
  const t = useTranslations('employee')
  const a = event.details as unknown as AssignmentRecord

  const rows: Array<{ label: string; value: string }> = [
    { label: t('assignmentEffectiveDate'), value: new Date(a.effectiveDate).toLocaleDateString('ko-KR') },
    { label: t('assignmentEndDate'), value: a.endDate ? new Date(a.endDate).toLocaleDateString('ko-KR') : t('assignmentCurrent') },
    { label: t('assignmentChangeType'), value: CHANGE_TYPE_LABELS[a.changeType] ? t(CHANGE_TYPE_LABELS[a.changeType]) : a.changeType },
    { label: t('assignmentCompany'), value: a.company?.name ?? '-' },
    { label: t('assignmentDepartment'), value: a.department?.name ?? '-' },
    { label: t('assignmentGrade'), value: a.jobGrade?.name ?? '-' },
    { label: t('assignmentJobCategory'), value: a.jobCategory?.name ?? '-' },
    { label: t('assignmentEmploymentType'), value: a.employmentType ?? '-' },
    { label: t('assignmentContractType'), value: a.contractType ?? '-' },
    { label: t('assignmentStatus'), value: a.status ?? '-' },
    { label: t('assignmentOrderNumber'), value: a.orderNumber ?? '-' },
    { label: t('assignmentReason'), value: a.reason ?? '-' },
    { label: t('assignmentApprover'), value: a.approver?.name ?? '-' },
  ]

  return (
    <div className="w-72 flex-shrink-0 rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-bold text-foreground">{t('assignmentDetailTitle')}</h3>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="p-4 space-y-2.5 overflow-y-auto max-h-96">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <Badge variant="outline" className="text-xs">{event.title}</Badge>
          <span className="text-xs text-muted-foreground">{new Date(event.date).toLocaleDateString('ko-KR')}</span>
        </div>
        {rows.map((row) => (
          <div key={row.label} className="flex items-start gap-2">
            <span className="w-20 flex-shrink-0 text-xs text-muted-foreground">{row.label}</span>
            <span className="text-xs text-foreground font-medium break-all">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── ConcurrentAssignment (for EndConcurrentDialog) ──────────

interface ConcurrentAssignment {
  id: string
  companyName: string
  departmentName: string | null
  positionTitle: string | null
  effectiveDate: string
}

// ─── ConcurrentStatusSection (HR_ADMIN only) ─────────────────

function ConcurrentStatusSection({
  assignments,
  onAdd,
  onEnd,
}: {
  assignments: AssignmentRecord[]
  onAdd: () => void
  onEnd: (a: ConcurrentAssignment) => void
}) {
  const t = useTranslations('employee')
  const activeConcurrents = assignments.filter(
    (a) => !a.isPrimary && a.endDate === null
  )

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <h3 className="text-sm font-bold text-foreground">{t('assignmentConcurrentStatus')}</h3>

      {activeConcurrents.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('assignmentNoConcurrent')}</p>
      ) : (
        <div className="space-y-2">
          {activeConcurrents.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
            >
              <span className="text-sm text-foreground">
                {[a.company?.name, a.department?.name].filter(Boolean).join(' · ')}
                <span className="ml-2 text-xs text-muted-foreground">
                  {new Date(a.effectiveDate).toLocaleDateString('ko-KR')} ~
                </span>
              </span>
              <Button
                variant="destructive"
                size="sm"
                className="h-7 text-xs"
                onClick={() =>
                  onEnd({
                    id: a.id,
                    companyName: a.company?.name ?? '',
                    departmentName: a.department?.name ?? null,
                    positionTitle: a.position?.titleKo ?? null,
                    effectiveDate: a.effectiveDate,
                  })
                }
              >
                {t('assignmentEnd')}
              </Button>
            </div>
          ))}
        </div>
      )}

      <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onAdd}>
        <Plus className="mr-1 h-3.5 w-3.5" />
        {t('assignmentAddConcurrent')}
      </Button>
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
  const t = useTranslations('employee')
  const isHrAdmin = user.role === ROLE.HR_ADMIN || user.role === ROLE.SUPER_ADMIN

  const [viewDate, setViewDate] = useState<Date>(new Date())
  const [assignments, setAssignments] = useState<AssignmentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null)
  const [snapshotLoading, setSnapshotLoading] = useState(false)

  // Dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [endDialogOpen, setEndDialogOpen] = useState(false)
  const [endTarget, setEndTarget] = useState<ConcurrentAssignment | null>(null)

  // 이력 로드
  const fetchHistory = useCallback(() => {
    setLoading(true)
    apiClient
      .get<{ assignments: AssignmentRecord[]; hireDate: string | null }>(
        `/api/v1/employees/${employeeId}/history`
      )
      .then((res) => setAssignments(res.data.assignments))
      .catch(() => setAssignments([]))
      .finally(() => setLoading(false))
  }, [employeeId])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

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

  // Build events with dual-render for ended concurrent assignments
  const events: TimelineEvent[] = []
  for (const a of assignments) {
    events.push(toTimelineEvent(a, viewDate, t))
    // Gemini #2: Dual render for ended concurrent
    if (a.changeType === 'CONCURRENT' && a.endDate) {
      events.push({
        id: `${a.id}-end`,
        date: a.endDate,
        type: 'CONCURRENT_END',
        title: t('assignmentConcurrentEnd'),
        description: [a.company?.name, a.department?.name].filter(Boolean).join(' · '),
        details: a as unknown as Record<string, unknown>,
        highlighted: false,
      })
    }
  }
  // Sort by date descending
  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

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

      {/* 겸직 현황 (HR_ADMIN only) */}
      {isHrAdmin && (
        <ConcurrentStatusSection
          assignments={assignments}
          onAdd={() => setAddDialogOpen(true)}
          onEnd={(a) => {
            setEndTarget(a)
            setEndDialogOpen(true)
          }}
        />
      )}

      {/* 타임라인 + 사이드패널 */}
      <div className="flex gap-4">
        <div className="flex-1 min-w-0 rounded-xl border border-border bg-card p-6">
          <AssignmentTimeline
            events={events}
            onEventClick={setSelectedEvent}
            loading={loading}
            emptyMessage={t('assignmentNoHistory')}
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
        <div className="text-xs text-muted-foreground text-center py-1 animate-pulse">{t('assignmentSnapshotLoading')}</div>
      )}

      {/* Dialogs */}
      {isHrAdmin && (
        <>
          <AddConcurrentDialog
            employeeId={employeeId}
            open={addDialogOpen}
            onOpenChange={setAddDialogOpen}
            onSuccess={fetchHistory}
            userRole={user.role}
            userCompanyId={user.companyId ?? ''}
          />
          <EndConcurrentDialog
            employeeId={employeeId}
            assignment={endTarget}
            open={endDialogOpen}
            onOpenChange={setEndDialogOpen}
            onSuccess={fetchHistory}
          />
        </>
      )}
    </div>
  )
}
