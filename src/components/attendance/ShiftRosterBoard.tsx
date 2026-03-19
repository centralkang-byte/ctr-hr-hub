'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — ShiftRosterBoard
// Visual Drag-and-Drop Shift Roster Grid for Deskless Workers
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Coffee,
  Loader2,
  GripVertical,
  Calendar,
  RefreshCw,
} from 'lucide-react'
import {
  format,
  addDays,
  addWeeks,
  subWeeks,
  startOfWeek,
  eachDayOfInterval,
  isWeekend,
  isToday,
} from 'date-fns'
import { ko } from 'date-fns/locale'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'

// ─── Types ──────────────────────────────────────────────────

type SlotName = 'morning' | 'night' | 'off'

interface ShiftBlockDef {
  type: SlotName
  label: string
  shortLabel: string
  defaultStart: string
  defaultEnd: string
  colorClass: string
  Icon: React.ElementType
}

interface EmployeeRow {
  id: string
  name: string
  employeeNo: string
  photoUrl: string | null
  department: string | null
  groupName: string | null
}

interface ScheduleEntry {
  id: string
  employeeId: string
  workDate: string // YYYY-MM-DD
  slotName: string | null
  startTime: string
  endTime: string
  isNightShift: boolean
}

interface CellState {
  scheduleId?: string
  slotName: SlotName
  startTime?: string
  endTime?: string
  isPending?: boolean // optimistic lock while saving
}

// employeeId -> dateStr -> CellState
type RosterMap = Record<string, Record<string, CellState>>

// ─── Constants ──────────────────────────────────────────────

const SHIFT_BLOCKS: ShiftBlockDef[] = [
  {
    type: 'morning',
    label: '주간 (Morning)',
    shortLabel: '주간',
    defaultStart: '08:00',
    defaultEnd: '17:00',
    colorClass:
      'bg-[#5E81F4]/10 text-[#5E81F4] border border-[#5E81F4]/20 hover:bg-[#5E81F4]/15',
    Icon: Sun,
  },
  {
    type: 'night',
    label: '야간 (Night)',
    shortLabel: '야간',
    defaultStart: '21:00',
    defaultEnd: '06:00',
    colorClass:
      'bg-[#1C1D21]/10 text-[#1C1D21] border border-[#1C1D21]/20 hover:bg-[#1C1D21]/15',
    Icon: Moon,
  },
  {
    type: 'off',
    label: '휴무 (Day Off)',
    shortLabel: '휴무',
    defaultStart: '',
    defaultEnd: '',
    colorClass:
      'bg-[#FF808B]/10 text-[#FF808B] border border-[#FF808B]/20 hover:bg-[#FF808B]/15',
    Icon: Coffee,
  },
]

const SHIFT_BY_TYPE: Record<SlotName, ShiftBlockDef> = Object.fromEntries(
  SHIFT_BLOCKS.map((b) => [b.type, b]),
) as Record<SlotName, ShiftBlockDef>

// ─── Helper — infer slot name from schedule data ─────────────

function inferSlotName(entry: ScheduleEntry): SlotName {
  if (entry.isNightShift) return 'night'
  const slot = (entry.slotName ?? '').toLowerCase()
  if (slot.includes('야간') || slot.includes('night')) return 'night'
  if (slot.includes('off') || slot.includes('휴무')) return 'off'
  return 'morning'
}

// ─── Helper — avatar initials ─────────────────────────────────

function getInitials(name: string): string {
  return name.slice(0, 1)
}

// ─── Component ──────────────────────────────────────────────

export function ShiftRosterBoard({ user: _user }: { user: SessionUser }) {
  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  )
  const [employees, setEmployees] = useState<EmployeeRow[]>([])
  const [rosterMap, setRosterMap] = useState<RosterMap>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<string | null>(null) // "employeeId_dateStr"
  const [error, setError] = useState<string | null>(null)
  const [draggedType, setDraggedType] = useState<SlotName | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null) // "employeeId_dateStr"
  const dragSourceRef = useRef<{
    employeeId: string
    dateStr: string
    slotName: SlotName
  } | null>(null)

  // ─── Compute date range ──────────────────────────────────────

  const days = eachDayOfInterval({
    start: weekStart,
    end: addDays(weekStart, 6),
  })

  const startDate = format(weekStart, 'yyyy-MM-dd')
  const endDate = format(addDays(weekStart, 6), 'yyyy-MM-dd')

  // ─── Fetch board data ────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.get<{
        employees: EmployeeRow[]
        schedules: ScheduleEntry[]
      }>(`/api/v1/attendance/shifts?startDate=${startDate}&endDate=${endDate}`)

      setEmployees(res.data.employees)

      // Build roster map from schedules
      const map: RosterMap = {}
      for (const emp of res.data.employees) {
        map[emp.id] = {}
      }
      for (const s of res.data.schedules) {
        if (!map[s.employeeId]) map[s.employeeId] = {}
        map[s.employeeId][s.workDate] = {
          scheduleId: s.id,
          slotName: inferSlotName(s),
          startTime: s.startTime,
          endTime: s.endTime,
        }
      }
      setRosterMap(map)
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터 로드 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  // ─── Navigation ──────────────────────────────────────────────

  const prevWeek = () => setWeekStart((d) => subWeeks(d, 1))
  const nextWeek = () => setWeekStart((d) => addWeeks(d, 1))
  const goToday = () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))

  // ─── DnD — Toolbar drag ──────────────────────────────────────

  const handleToolbarDragStart = (
    e: React.DragEvent,
    shiftType: SlotName,
  ) => {
    e.dataTransfer.setData('application/x-shift-type', shiftType)
    e.dataTransfer.effectAllowed = 'copy'
    setDraggedType(shiftType)
    dragSourceRef.current = null
  }

  // ─── DnD — Cell drag (move existing assignment) ──────────────

  const handleCellDragStart = (
    e: React.DragEvent,
    employeeId: string,
    dateStr: string,
    slotName: SlotName,
  ) => {
    e.dataTransfer.setData('application/x-shift-type', slotName)
    e.dataTransfer.setData('application/x-source-employee', employeeId)
    e.dataTransfer.setData('application/x-source-date', dateStr)
    e.dataTransfer.effectAllowed = 'move'
    setDraggedType(slotName)
    dragSourceRef.current = { employeeId, dateStr, slotName }
  }

  const handleDragEnd = () => {
    setDraggedType(null)
    setDropTarget(null)
    dragSourceRef.current = null
  }

  // ─── DnD — Cell drop target ──────────────────────────────────

  const handleDragOver = (
    e: React.DragEvent,
    employeeId: string,
    dateStr: string,
  ) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = dragSourceRef.current ? 'move' : 'copy'
    setDropTarget(`${employeeId}_${dateStr}`)
  }

  const handleDragLeave = () => {
    setDropTarget(null)
  }

  const handleDrop = async (
    e: React.DragEvent,
    targetEmployeeId: string,
    targetDateStr: string,
  ) => {
    e.preventDefault()
    setDropTarget(null)

    const shiftType = e.dataTransfer.getData(
      'application/x-shift-type',
    ) as SlotName
    if (!shiftType) return

    const source = dragSourceRef.current

    // Skip if dropping on the same cell
    if (
      source &&
      source.employeeId === targetEmployeeId &&
      source.dateStr === targetDateStr
    ) {
      return
    }

    const cellKey = `${targetEmployeeId}_${targetDateStr}`
    const block = SHIFT_BY_TYPE[shiftType]

    // ── Optimistic update ──
    setRosterMap((prev) => {
      const next = { ...prev }

      // If move: clear source cell
      if (source) {
        next[source.employeeId] = { ...next[source.employeeId] }
        delete next[source.employeeId][source.dateStr]
      }

      // Set target cell
      next[targetEmployeeId] = { ...next[targetEmployeeId] }
      if (shiftType === 'off') {
        delete next[targetEmployeeId][targetDateStr]
      } else {
        next[targetEmployeeId][targetDateStr] = {
          slotName: shiftType,
          startTime: block.defaultStart,
          endTime: block.defaultEnd,
          isPending: true,
        }
      }
      return next
    })

    // ── API call ──
    setSaving(cellKey)
    try {
      // If move: also clear old cell via API
      if (source) {
        await apiClient.post('/api/v1/attendance/shifts', {
          employeeId: source.employeeId,
          workDate: source.dateStr,
          slotName: 'off', // delete source
        })
      }

      await apiClient.post('/api/v1/attendance/shifts', {
        employeeId: targetEmployeeId,
        workDate: targetDateStr,
        slotName: shiftType,
      })

      // Remove isPending flag on success
      setRosterMap((prev) => {
        if (!prev[targetEmployeeId]?.[targetDateStr]) return prev
        const next = { ...prev }
        next[targetEmployeeId] = { ...next[targetEmployeeId] }
        next[targetEmployeeId][targetDateStr] = {
          ...next[targetEmployeeId][targetDateStr],
          isPending: false,
        }
        return next
      })
    } catch {
      // Rollback optimistic update on error
      void fetchData()
    } finally {
      setSaving(null)
    }
  }

  // ─── Render ──────────────────────────────────────────────────

  const weekLabel = `${format(weekStart, 'yyyy년 MM월 dd일', { locale: ko })} – ${format(addDays(weekStart, 6), 'MM월 dd일', { locale: ko })}`

  return (
    <div className="flex h-full flex-col gap-4">
      {/* ── Page header ─────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1C1D21]">근무 배정표</h1>
          <p className="text-sm text-[#8181A5]">
            현장 근무자의 교대 일정을 시각적으로 관리합니다.
          </p>
        </div>
        <button
          onClick={() => void fetchData()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#F0F0F3] bg-white px-3 py-2 text-sm text-[#1C1D21] transition-colors hover:bg-[#F5F5FA]"
        >
          <RefreshCw className="h-4 w-4" />
          새로고침
        </button>
      </div>

      {/* ── Week navigation ──────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          onClick={prevWeek}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#F0F0F3] bg-white transition-colors hover:bg-[#F5F5FA]"
        >
          <ChevronLeft className="h-4 w-4 text-[#1C1D21]" />
        </button>
        <div className="flex items-center gap-2 rounded-lg border border-[#F0F0F3] bg-white px-4 py-1.5">
          <Calendar className="h-4 w-4 text-[#8181A5]" />
          <span className="text-sm font-semibold text-[#1C1D21]">{weekLabel}</span>
        </div>
        <button
          onClick={nextWeek}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#F0F0F3] bg-white transition-colors hover:bg-[#F5F5FA]"
        >
          <ChevronRight className="h-4 w-4 text-[#1C1D21]" />
        </button>
        <button
          onClick={goToday}
          className="rounded-lg border border-[#F0F0F3] bg-white px-3 py-1.5 text-xs font-medium text-[#1C1D21] transition-colors hover:bg-[#F5F5FA]"
        >
          오늘
        </button>
      </div>

      {/* ── Main layout: toolbar + grid ──────────────────────── */}
      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* ── Left: Shift toolbar ─────────────────────────────── */}
        <div className="flex w-44 flex-shrink-0 flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8181A5]">
            근무 유형
          </p>
          <p className="text-xs text-[#8181A5]">드래그하여 배정</p>

          {SHIFT_BLOCKS.map((block) => {
            const { Icon } = block
            return (
              <div
                key={block.type}
                draggable
                onDragStart={(e) => handleToolbarDragStart(e, block.type)}
                onDragEnd={handleDragEnd}
                className={`flex cursor-grab items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-transform active:scale-95 active:cursor-grabbing ${block.colorClass}`}
              >
                <GripVertical className="h-3.5 w-3.5 opacity-50" />
                <Icon className="h-4 w-4 flex-shrink-0" />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold">{block.shortLabel}</span>
                  {block.defaultStart && (
                    <span className="text-[10px] opacity-60">
                      {block.defaultStart}–{block.defaultEnd}
                    </span>
                  )}
                </div>
              </div>
            )
          })}

          {/* Legend */}
          <div className="mt-4 rounded-lg border border-[#F0F0F3] bg-[#F5F5FA] p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#8181A5]">
              범례
            </p>
            <ul className="space-y-1.5">
              <li className="flex items-center gap-2 text-xs text-[#1C1D21]">
                <span className="h-2.5 w-2.5 rounded-full bg-[#5E81F4]" />
                주간 (8h–17h)
              </li>
              <li className="flex items-center gap-2 text-xs text-[#1C1D21]">
                <span className="h-2.5 w-2.5 rounded-full bg-[#1C1D21]" />
                야간 (21h–6h)
              </li>
              <li className="flex items-center gap-2 text-xs text-[#1C1D21]">
                <span className="h-2.5 w-2.5 rounded-full bg-[#FF808B]" />
                휴무
              </li>
            </ul>
          </div>
        </div>

        {/* ── Right: Roster grid ──────────────────────────────── */}
        <div className="relative flex-1 overflow-hidden rounded-xl border border-[#F0F0F3] bg-white">
          {loading && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/70">
              <Loader2 className="h-6 w-6 animate-spin text-[#5E81F4]" />
            </div>
          )}

          {error && (
            <div className="m-6 rounded-lg bg-[#FF808B]/10 p-4 text-sm text-[#FF808B]">
              {error}
            </div>
          )}

          {!loading && !error && employees.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-12 text-center">
              <Calendar className="h-12 w-12 text-[#F0F0F3]" />
              <p className="text-sm font-medium text-[#1C1D21]">
                배정된 근무자가 없습니다
              </p>
              <p className="max-w-xs text-xs text-[#8181A5]">
                교대 그룹에 구성원을 추가하거나, 설정 → 교대 패턴에서
                스케줄을 생성하세요.
              </p>
            </div>
          )}

          {!error && employees.length > 0 && (
            <div className="h-full overflow-auto">
              <table className="min-w-full border-collapse text-sm">
                {/* ── Sticky header row ─── */}
                <thead>
                  <tr>
                    {/* Employee column header */}
                    <th className="sticky left-0 top-0 z-20 min-w-[180px] border-b border-r border-[#F0F0F3] bg-white px-4 py-3 text-left">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8181A5]">
                        직원
                      </span>
                    </th>

                    {/* Date columns */}
                    {days.map((day) => {
                      const dateStr = format(day, 'yyyy-MM-dd')
                      const isWknd = isWeekend(day)
                      const isTdy = isToday(day)
                      return (
                        <th
                          key={dateStr}
                          className={`sticky top-0 z-10 min-w-[90px] border-b border-r border-[#F0F0F3] bg-white px-2 py-3 text-center ${
                            isTdy ? 'bg-[#5E81F4]/5' : ''
                          }`}
                        >
                          <div className="flex flex-col items-center gap-0.5">
                            <span
                              className={`text-[11px] font-semibold uppercase ${
                                isWknd ? 'text-[#FF808B]' : 'text-[#8181A5]'
                              }`}
                            >
                              {format(day, 'EEE', { locale: ko })}
                            </span>
                            <span
                              className={`flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold ${
                                isTdy
                                  ? 'bg-[#5E81F4] text-white'
                                  : isWknd
                                    ? 'text-[#FF808B]'
                                    : 'text-[#1C1D21]'
                              }`}
                            >
                              {format(day, 'd')}
                            </span>
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>

                {/* ── Employee rows ──── */}
                <tbody>
                  {employees.map((emp, rowIdx) => (
                    <tr
                      key={emp.id}
                      className={`border-b border-[#F0F0F3] ${
                        rowIdx % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFA]'
                      }`}
                    >
                      {/* Sticky employee column */}
                      <td
                        className={`sticky left-0 z-10 border-r border-[#F0F0F3] px-4 py-2.5 ${
                          rowIdx % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFA]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          {emp.photoUrl ? (
                            <img
                              src={emp.photoUrl}
                              alt={emp.name}
                              className="h-8 w-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#5E81F4]/10 text-sm font-bold text-[#5E81F4]">
                              {getInitials(emp.name)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold text-[#1C1D21]">
                              {emp.name}
                            </p>
                            <p className="truncate text-[11px] text-[#8181A5]">
                              {emp.department ?? emp.groupName ?? emp.employeeNo}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Date cells */}
                      {days.map((day) => {
                        const dateStr = format(day, 'yyyy-MM-dd')
                        const cellKey = `${emp.id}_${dateStr}`
                        const cell = rosterMap[emp.id]?.[dateStr]
                        const isDropTarget = dropTarget === cellKey
                        const isSaving = saving === cellKey
                        const isWknd = isWeekend(day)
                        const isTdy = isToday(day)

                        return (
                          <td
                            key={dateStr}
                            className={`border-r border-[#F0F0F3] p-1 text-center transition-colors ${
                              isDropTarget
                                ? 'bg-[#5E81F4]/10 ring-1 ring-inset ring-[#5E81F4]/30'
                                : isTdy
                                  ? 'bg-[#5E81F4]/5'
                                  : isWknd
                                    ? 'bg-[#F5F5FA]/60'
                                    : ''
                            }`}
                            onDragOver={(e) =>
                              handleDragOver(e, emp.id, dateStr)
                            }
                            onDragLeave={handleDragLeave}
                            onDrop={(e) =>
                              void handleDrop(e, emp.id, dateStr)
                            }
                          >
                            {cell ? (
                              <ShiftCell
                                cell={cell}
                                isSaving={isSaving}
                                employeeId={emp.id}
                                dateStr={dateStr}
                                onDragStart={handleCellDragStart}
                                onDragEnd={handleDragEnd}
                              />
                            ) : (
                              <EmptyCell isDropTarget={isDropTarget} />
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── DnD ghost indicator ──────────────────────────────── */}
      {draggedType && (
        <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full border border-[#F0F0F3] bg-white px-4 py-2 shadow-lg">
          <div
            className={`h-2 w-2 rounded-full ${
              draggedType === 'morning'
                ? 'bg-[#5E81F4]'
                : draggedType === 'night'
                  ? 'bg-[#1C1D21]'
                  : 'bg-[#FF808B]'
            }`}
          />
          <span className="text-xs font-medium text-[#1C1D21]">
            {SHIFT_BY_TYPE[draggedType]?.shortLabel} 배정 중…
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────

function ShiftCell({
  cell,
  isSaving,
  employeeId,
  dateStr,
  onDragStart,
  onDragEnd,
}: {
  cell: CellState
  isSaving: boolean
  employeeId: string
  dateStr: string
  onDragStart: (
    e: React.DragEvent,
    employeeId: string,
    dateStr: string,
    slotName: SlotName,
  ) => void
  onDragEnd: () => void
}) {
  const block = SHIFT_BY_TYPE[cell.slotName]
  if (!block) return null
  const { Icon } = block

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, employeeId, dateStr, cell.slotName)}
      onDragEnd={onDragEnd}
      className={`inline-flex h-12 w-full cursor-grab flex-col items-center justify-center gap-0.5 rounded-lg px-2 text-xs font-semibold transition-all active:scale-95 active:cursor-grabbing ${block.colorClass} ${
        cell.isPending || isSaving ? 'opacity-60' : ''
      }`}
      title={`${block.label}${cell.startTime ? ` (${cell.startTime}–${cell.endTime})` : ''}`}
    >
      {isSaving ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Icon className="h-3.5 w-3.5" />
      )}
      <span>{block.shortLabel}</span>
    </div>
  )
}

function EmptyCell({ isDropTarget }: { isDropTarget: boolean }) {
  return (
    <div
      className={`flex h-12 w-full items-center justify-center rounded-xl border border-dashed transition-colors ${
        isDropTarget
          ? 'border-[#5E81F4] bg-[#5E81F4]/5'
          : 'border-[#F0F0F3] bg-transparent hover:border-[#C4C4D4] hover:bg-[#F5F5FA]'
      }`}
    >
      <span className="text-[10px] text-[#C4C4D4]">
        {isDropTarget ? '놓기' : '—'}
      </span>
    </div>
  )
}
