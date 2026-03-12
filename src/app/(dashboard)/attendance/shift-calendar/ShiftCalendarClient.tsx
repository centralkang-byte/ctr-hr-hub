'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Shift Calendar Client
// 교대근무 월간 스케줄 캘린더 뷰
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Users,
  RefreshCw,
  Loader2,
  ArrowRightLeft,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import { TABLE_STYLES } from '@/lib/styles'

// ─── Types ──────────────────────────────────────────────────

interface ShiftSlot {
  name: string
  startTime: string
  endTime: string
  breakMinutes: number
  isNightShift: boolean
}

interface ShiftPattern {
  id: string
  name: string
  type: string
  slots: ShiftSlot[]
  rotationDays: number | null
  isActive: boolean
}

interface ShiftGroup {
  id: string
  name: string
  color: string
  patternId: string
  pattern?: ShiftPattern
  _count?: { members: number }
}

interface ShiftScheduleEntry {
  id: string
  employeeId: string
  employee: {
    id: string
    firstName: string
    lastName: string
    employeeNumber: string
    department?: { name: string } | null
  }
  shiftGroupId: string
  shiftGroup: { name: string; color: string }
  date: string
  slotIndex: number
  slotName: string
  startTime: string
  endTime: string
  status: string
}

interface ChangeRequest {
  id: string
  requesterId: string
  requester: { firstName: string; lastName: string }
  targetEmployeeId: string
  targetEmployee: { firstName: string; lastName: string }
  originalDate: string
  requestedDate: string
  reason: string
  status: string
  createdAt: string
}

// ─── Constants ──────────────────────────────────────────────

const SLOT_COLORS: Record<number, string> = {
  0: 'bg-[#E8F5E9] text-[#00A844] border-[#E8F5E9]',
  1: 'bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]',
  2: 'bg-[#F3E8FF] text-[#6B21A8] border-[#E9D5FF]',
  3: 'bg-[#D1FAE5] text-[#065F46] border-[#A7F3D0]',
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  SCHEDULED: { label: '예정', color: 'bg-[#E8F5E9] text-[#00A844] border-[#E8F5E9]' },
  WORKED: { label: '완료', color: 'bg-[#D1FAE5] text-[#047857] border-[#A7F3D0]' },
  ABSENT: { label: '결근', color: 'bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]' },
  SWAPPED: { label: '교대변경', color: 'bg-[#FEF3C7] text-[#B45309] border-[#FCD34D]' },
}

const REQUEST_STATUS_MAP: Record<string, { label: string; color: string }> = {
  SCR_PENDING: { label: '대기', color: 'bg-[#FEF3C7] text-[#B45309] border-[#FCD34D]' },
  SCR_APPROVED: { label: '승인', color: 'bg-[#D1FAE5] text-[#047857] border-[#A7F3D0]' },
  SCR_REJECTED: { label: '반려', color: 'bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]' },
}

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

// ─── Helpers ────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = []
  const last = new Date(year, month, 0).getDate()
  for (let d = 1; d <= last; d++) {
    days.push(new Date(year, month - 1, d))
  }
  return days
}

function getFirstDayOffset(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay()
}

function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// ─── Component ──────────────────────────────────────────────

export function ShiftCalendarClient({ user }: { user: SessionUser }) {
  void user

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar')
  const [selectedGroup, setSelectedGroup] = useState<string>('all')

  const [groups, setGroups] = useState<ShiftGroup[]>([])
  const [schedules, setSchedules] = useState<ShiftScheduleEntry[]>([])
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  // Detail modal
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // ─── Data Fetching ───
  const fetchGroups = useCallback(async () => {
    try {
      const res = await apiClient.get<{ data: ShiftGroup[] }>('/api/v1/shift-groups')
      setGroups(res.data?.data ?? [])
    } catch {
      setGroups([])
    }
  }, [])

  const fetchSchedules = useCallback(async () => {
    try {
      const res = await apiClient.get<{ data: ShiftScheduleEntry[] }>(
        `/api/v1/shift-schedules/${year}/${month}`
      )
      setSchedules(res.data?.data ?? [])
    } catch {
      setSchedules([])
    }
  }, [year, month])

  const fetchChangeRequests = useCallback(async () => {
    try {
      const res = await apiClient.get<{ data: ChangeRequest[] }>(
        '/api/v1/shift-change-requests?status=SCR_PENDING'
      )
      setChangeRequests(res.data?.data ?? [])
    } catch {
      setChangeRequests([])
    }
  }, [])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    await Promise.all([fetchGroups(), fetchSchedules(), fetchChangeRequests()])
    setLoading(false)
  }, [fetchGroups, fetchSchedules, fetchChangeRequests])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  // ─── Generate Schedules ───
  const handleGenerate = async () => {
    setGenerating(true)
    try {
      await apiClient.post('/api/v1/shift-schedules/generate', { year, month })
      await fetchSchedules()
    } catch {
      // handled by apiClient
    } finally {
      setGenerating(false)
    }
  }

  // ─── Month Navigation ───
  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  // ─── Derived Data ───
  const filteredSchedules = selectedGroup === 'all'
    ? schedules
    : schedules.filter(s => s.shiftGroupId === selectedGroup)

  const days = getDaysInMonth(year, month)
  const firstDayOffset = getFirstDayOffset(year, month)

  // Group schedules by date
  const schedulesByDate = new Map<string, ShiftScheduleEntry[]>()
  for (const s of filteredSchedules) {
    const dateKey = s.date.split('T')[0]
    const existing = schedulesByDate.get(dateKey) ?? []
    existing.push(s)
    schedulesByDate.set(dateKey, existing)
  }

  // Group schedules by employee for list view
  const schedulesByEmployee = new Map<string, ShiftScheduleEntry[]>()
  for (const s of filteredSchedules) {
    const key = s.employeeId
    const existing = schedulesByEmployee.get(key) ?? []
    existing.push(s)
    schedulesByEmployee.set(key, existing)
  }

  // ─── KPI ───
  const totalEmployees = new Set(schedules.map(s => s.employeeId)).size
  const totalScheduled = schedules.filter(s => s.status === 'SCHEDULED').length
  const totalWorked = schedules.filter(s => s.status === 'WORKED').length
  const pendingSwaps = changeRequests.length

  // ─── Date Detail Modal Data ───
  const dateSchedules = selectedDate ? (schedulesByDate.get(selectedDate) ?? []) : []

  // ─── Loading ───
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#00C853]" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A] flex items-center gap-2 tracking-[-0.02em]">
            <Calendar className="h-6 w-6 text-[#00C853]" />
            교대근무 캘린더
          </h1>
          <p className="text-sm text-[#999] mt-1">월간 교대 스케줄 배정 현황</p>
        </div>
        <Button
          onClick={handleGenerate}
          disabled={generating}
          className={BUTTON_VARIANTS.primary}
        >
          {generating ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          스케줄 자동생성
        </Button>
      </div>

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
          <p className="text-xs text-[#999] font-medium mb-2">배정 인원</p>
          <p className="text-3xl font-bold text-[#1A1A1A] tracking-[-0.02em]">{totalEmployees}</p>
        </div>
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
          <p className="text-xs text-[#999] font-medium mb-2">예정 스케줄</p>
          <p className="text-3xl font-bold text-[#2196F3] tracking-[-0.02em]">{totalScheduled}</p>
        </div>
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
          <p className="text-xs text-[#999] font-medium mb-2">완료</p>
          <p className="text-3xl font-bold text-[#00C853] tracking-[-0.02em]">{totalWorked}</p>
        </div>
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
          <p className="text-xs text-[#999] font-medium mb-2">교대변경 요청</p>
          <p className="text-3xl font-bold text-[#FF9800] tracking-[-0.02em]">{pendingSwaps}</p>
        </div>
      </div>

      {/* ─── Controls ─── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="p-1.5 hover:bg-[#F5F5F5] rounded-lg border border-[#E8E8E8]">
            <ChevronLeft className="h-4 w-4 text-[#666]" />
          </button>
          <h2 className="text-base font-bold text-[#1A1A1A] min-w-[120px] text-center tracking-[-0.02em]">
            {year}년 {month}월
          </h2>
          <button onClick={nextMonth} className="p-1.5 hover:bg-[#F5F5F5] rounded-lg border border-[#E8E8E8]">
            <ChevronRight className="h-4 w-4 text-[#666]" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <Select value={selectedGroup} onValueChange={setSelectedGroup}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="교대조 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 교대조</SelectItem>
              {groups.map(g => (
                <SelectItem key={g.id} value={g.id}>
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ backgroundColor: g.color }}
                    />
                    {g.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex rounded-lg border border-[#E8E8E8]">
            <button
              className={`px-3 py-1.5 text-sm font-medium rounded-l-lg ${
                viewMode === 'calendar'
                  ? 'bg-[#1A1A1A] text-white'
                  : 'bg-white text-[#666] hover:bg-[#F5F5F5]'
              }`}
              onClick={() => setViewMode('calendar')}
            >
              캘린더
            </button>
            <button
              className={`px-3 py-1.5 text-sm font-medium rounded-r-lg ${
                viewMode === 'list'
                  ? 'bg-[#1A1A1A] text-white'
                  : 'bg-white text-[#666] hover:bg-[#F5F5F5]'
              }`}
              onClick={() => setViewMode('list')}
            >
              리스트
            </button>
          </div>
        </div>
      </div>

      {/* ─── Legend ─── */}
      <div className="flex flex-wrap items-center gap-3">
        {groups.map(g => (
          <div key={g.id} className="flex items-center gap-1.5 text-xs text-[#666]">
            <span
              className="inline-block h-3 w-3 rounded-full border"
              style={{ backgroundColor: g.color }}
            />
            {g.name}
          </div>
        ))}
        <div className="ml-4 flex items-center gap-3">
          {Object.entries(STATUS_MAP).map(([key, val]) => (
            <span
              key={key}
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${val.color}`}
            >
              {val.label}
            </span>
          ))}
        </div>
      </div>

      {/* ─── Calendar View ─── */}
      {viewMode === 'calendar' && (
        <Card>
          <CardContent className="p-4">
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-2">
              {DAY_LABELS.map((label, idx) => (
                <div
                  key={label}
                  className={`text-center text-xs font-medium py-2 ${
                    idx === 0 ? 'text-[#F44336]' : idx === 6 ? 'text-[#2196F3]' : 'text-[#999]'
                  }`}
                >
                  {label}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-px bg-[#E8E8E8] rounded-lg overflow-hidden">
              {/* Empty cells before first day */}
              {Array.from({ length: firstDayOffset }).map((_, i) => (
                <div key={`empty-${i}`} className="bg-[#FAFAFA] min-h-[100px] p-1" />
              ))}

              {/* Day cells */}
              {days.map(date => {
                const dateKey = formatDateKey(date)
                const daySchedules = schedulesByDate.get(dateKey) ?? []
                const isToday = dateKey === formatDateKey(now)
                const dayOfWeek = date.getDay()
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

                return (
                  <button
                    key={dateKey}
                    type="button"
                    onClick={() => {
                      setSelectedDate(dateKey)
                      setDetailOpen(true)
                    }}
                    className={`bg-white min-h-[100px] p-1.5 text-left hover:bg-[#FAFAFA] transition-colors ${
                      isToday ? 'ring-2 ring-[#00C853] ring-inset' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-xs font-medium ${
                          isToday
                            ? 'bg-[#00C853] text-white rounded-full w-5 h-5 flex items-center justify-center'
                            : isWeekend
                              ? dayOfWeek === 0 ? 'text-[#F44336]' : 'text-[#2196F3]'
                              : 'text-[#666]'
                        }`}
                      >
                        {date.getDate()}
                      </span>
                      {daySchedules.length > 0 && (
                        <span className="text-[10px] text-[#999]">
                          {daySchedules.length}명
                        </span>
                      )}
                    </div>

                    {/* Schedule chips (max 3 visible) */}
                    <div className="space-y-0.5">
                      {daySchedules.slice(0, 3).map(s => (
                        <div
                          key={s.id}
                          className={`text-[10px] px-1 py-0.5 rounded truncate border ${
                            SLOT_COLORS[s.slotIndex] ?? SLOT_COLORS[0]
                          }`}
                          title={`${s.employee.lastName}${s.employee.firstName} - ${s.slotName}`}
                        >
                          <span
                            className="inline-block w-1.5 h-1.5 rounded-full mr-0.5"
                            style={{ backgroundColor: s.shiftGroup.color }}
                          />
                          {s.employee.lastName}{s.slotName}
                        </div>
                      ))}
                      {daySchedules.length > 3 && (
                        <div className="text-[10px] text-[#999] pl-1">
                          +{daySchedules.length - 3}명 더
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── List View ─── */}
      {viewMode === 'list' && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className={TABLE_STYLES.header}>
                    <th className="sticky left-0 z-10 bg-[#FAFAFA] px-4 py-3 text-left text-xs font-medium text-[#999] font-semibold">
                      직원
                    </th>
                    {days.map(date => {
                      const dayOfWeek = date.getDay()
                      return (
                        <th
                          key={formatDateKey(date)}
                          className={`min-w-[44px] px-1 py-3 text-center text-xs font-medium ${
                            dayOfWeek === 0
                              ? 'text-[#F44336]'
                              : dayOfWeek === 6
                                ? 'text-[#2196F3]'
                                : 'text-[#999]'
                          }`}
                        >
                          <div>{date.getDate()}</div>
                          <div className="text-[10px]">{DAY_LABELS[dayOfWeek]}</div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {Array.from(schedulesByEmployee.entries()).map(([empId, empSchedules]) => {
                    const emp = empSchedules[0]?.employee
                    if (!emp) return null
                    const schedMap = new Map<string, ShiftScheduleEntry>()
                    for (const s of empSchedules) {
                      schedMap.set(s.date.split('T')[0], s)
                    }

                    return (
                      <tr key={empId} className="border-t border-[#F0F0F0] hover:bg-[#FAFAFA]">
                        <td className="sticky left-0 z-10 bg-white px-4 py-2 font-medium whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-sm">{emp.lastName}{emp.firstName}</span>
                            <span className="text-xs text-[#999]">{emp.employeeNumber}</span>
                          </div>
                        </td>
                        {days.map(date => {
                          const dateKey = formatDateKey(date)
                          const sched = schedMap.get(dateKey)

                          if (!sched) {
                            return <td key={dateKey} className="px-1 py-1 text-center">—</td>
                          }

                          return (
                            <td key={dateKey} className="px-1 py-1 text-center">
                              <span
                                className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                                  SLOT_COLORS[sched.slotIndex] ?? SLOT_COLORS[0]
                                }`}
                                title={`${sched.slotName} ${sched.startTime}-${sched.endTime}`}
                              >
                                {sched.slotName.charAt(0)}
                              </span>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Change Requests Section ─── */}
      {changeRequests.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-[#FF9800]" />
              교대변경 요청 ({changeRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {changeRequests.map(req => {
                const st = REQUEST_STATUS_MAP[req.status] ?? REQUEST_STATUS_MAP.SCR_PENDING
                return (
                  <div
                    key={req.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-[#E8E8E8] bg-[#FAFAFA]/50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-sm">
                        <span className="font-medium">
                          {req.requester.lastName}{req.requester.firstName}
                        </span>
                        <span className="text-[#999] mx-2">→</span>
                        <span className="font-medium">
                          {req.targetEmployee.lastName}{req.targetEmployee.firstName}
                        </span>
                      </div>
                      <div className="text-xs text-[#999]">
                        {req.originalDate.split('T')[0]} ↔ {req.requestedDate.split('T')[0]}
                      </div>
                      <span className="text-xs text-[#999]">{req.reason}</span>
                    </div>
                    <Badge className={`${st.color} border`}>{st.label}</Badge>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Date Detail Modal ─── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[#00C853]" />
              {selectedDate} 교대 스케줄
            </DialogTitle>
          </DialogHeader>

          {dateSchedules.length === 0 ? (
            <div className="text-center py-8 text-sm text-[#999]">
              이 날짜에 배정된 스케줄이 없습니다.
            </div>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {dateSchedules.map(s => {
                const st = STATUS_MAP[s.status] ?? STATUS_MAP.SCHEDULED
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-[#E8E8E8]"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="inline-block h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ backgroundColor: s.shiftGroup.color }}
                      >
                        {s.shiftGroup.name.charAt(0)}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-[#1A1A1A]">
                          {s.employee.lastName}{s.employee.firstName}
                        </p>
                        <p className="text-xs text-[#999]">
                          {s.employee.department?.name ?? ''} · {s.employee.employeeNumber}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                        SLOT_COLORS[s.slotIndex] ?? SLOT_COLORS[0]
                      }`}>
                        {s.slotName}
                      </div>
                      <p className="text-xs text-[#999] mt-1">
                        {s.startTime} - {s.endTime}
                      </p>
                      <Badge className={`${st.color} border mt-1`}>{st.label}</Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
