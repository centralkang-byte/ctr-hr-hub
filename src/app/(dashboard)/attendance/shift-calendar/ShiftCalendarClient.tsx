'use client'

import { useTranslations, useLocale } from 'next-intl'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { EmptyState } from '@/components/ui/EmptyState'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Shift Calendar Client
// 교대근무 월간 스케줄 캘린더 뷰
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
    RefreshCw,
  Loader2,
  ArrowRightLeft,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/StatusBadge'
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
import { TYPOGRAPHY } from '@/lib/styles/typography'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import { BUTTON_VARIANTS,  TABLE_STYLES } from '@/lib/styles'

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
  0: 'bg-primary/10 text-primary/90 border-primary/20',
  1: 'bg-amber-500/15 text-amber-800 border-amber-300',
  2: 'bg-purple-500/10 text-purple-800 border-purple-200',
  3: 'bg-emerald-500/15 text-emerald-800 border-emerald-200',
}

const STATUS_MAP: Record<string, { labelKey: string }> = {
  SCHEDULED: { labelKey: 'statusScheduled' },
  WORKED: { labelKey: 'statusWorked' },
  ABSENT: { labelKey: 'statusAbsent' },
  SWAPPED: { labelKey: 'statusSwapped' },
}

const REQUEST_STATUS_MAP: Record<string, { labelKey: string }> = {
  SCR_PENDING: { labelKey: 'requestPending' },
  SCR_APPROVED: { labelKey: 'requestApproved' },
  SCR_REJECTED: { labelKey: 'requestRejected' },
}

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
  const tCommon = useTranslations('common')
  const t = useTranslations('shift')
  const ta = useTranslations('attendance')
  const locale = useLocale()
  void locale

  const DAY_LABELS = [ta('daySun'), ta('dayMon'), ta('dayTue'), ta('dayWed'), ta('dayThu'), ta('dayFri'), ta('daySat')]

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
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2 tracking-[-0.02em]">
            <Calendar className="h-6 w-6 text-primary" />
            {t('calendarTitle')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t('calendarDesc')}</p>
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
          {t('autoGenerate')}
        </Button>
      </div>

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-card border border-border rounded-xl p-6">
          <p className="text-xs text-muted-foreground font-medium mb-2">{t('assignedCount')}</p>
          <p className={TYPOGRAPHY.stat}><AnimatedNumber value={totalEmployees} /></p>
        </div>
        <div className="bg-card border border-border rounded-xl p-6">
          <p className="text-xs text-muted-foreground font-medium mb-2">{t('scheduledCount')}</p>
          <p className="text-3xl font-bold tabular-nums text-primary"><AnimatedNumber value={totalScheduled} /></p>
        </div>
        <div className="bg-card border border-border rounded-xl p-6">
          <p className="text-xs text-muted-foreground font-medium mb-2">{t('completedCount')}</p>
          <p className="text-3xl font-bold tabular-nums text-emerald-600"><AnimatedNumber value={totalWorked} /></p>
        </div>
        <div className="bg-card border border-border rounded-xl p-6">
          <p className="text-xs text-muted-foreground font-medium mb-2">{t('changeRequestCount')}</p>
          <p className="text-3xl font-bold tabular-nums text-amber-500"><AnimatedNumber value={pendingSwaps} /></p>
        </div>
      </div>

      {/* ─── Controls ─── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="p-1.5 hover:bg-muted rounded-lg border border-border">
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          </button>
          <h2 className="text-base font-bold text-foreground min-w-[120px] text-center tracking-[-0.02em]">
            {t('yearSuffix', { year })} {t('monthSuffix', { month })}
          </h2>
          <button onClick={nextMonth} className="p-1.5 hover:bg-muted rounded-lg border border-border">
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <Select value={selectedGroup} onValueChange={setSelectedGroup}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder={tCommon('filterSelectShift')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allGroups')}</SelectItem>
              {!groups?.length && <EmptyState />}
              {groups?.map(g => (
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

          <div className="flex rounded-lg border border-border">
            <button
              className={`px-3 py-1.5 text-sm font-medium rounded-l-lg ${
                viewMode === 'calendar'
                  ? 'bg-foreground text-white'
                  : 'bg-card text-muted-foreground hover:bg-muted'
              }`}
              onClick={() => setViewMode('calendar')}
            >
              {t('calendarView')}
            </button>
            <button
              className={`px-3 py-1.5 text-sm font-medium rounded-r-lg ${
                viewMode === 'list'
                  ? 'bg-foreground text-white'
                  : 'bg-card text-muted-foreground hover:bg-muted'
              }`}
              onClick={() => setViewMode('list')}
            >
              {t('listView')}
            </button>
          </div>
        </div>
      </div>

      {/* ─── Legend ─── */}
      <div className="flex flex-wrap items-center gap-3">
        {!groups?.length && <EmptyState />}
              {groups?.map(g => (
          <div key={g.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className="inline-block h-3 w-3 rounded-full border"
              style={{ backgroundColor: g.color }}
            />
            {g.name}
          </div>
        ))}
        <div className="ml-4 flex items-center gap-3">
          {Object.entries(STATUS_MAP).map(([key, val]) => (
            <StatusBadge key={key} status={key}>
              {t(val.labelKey)}
            </StatusBadge>
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
                    idx === 0 ? 'text-red-500' : idx === 6 ? 'text-blue-500' : 'text-muted-foreground'
                  }`}
                >
                  {label}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
              {/* Empty cells before first day */}
              {Array.from({ length: firstDayOffset }).map((_, i) => (
                <div key={`empty-${i}`} className="bg-background min-h-[100px] p-1" />
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
                    className={`bg-card min-h-[100px] p-1.5 text-left hover:bg-background transition-colors ${
                      isToday ? 'ring-2 ring-primary ring-inset' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-xs font-medium ${
                          isToday
                            ? 'bg-primary text-white rounded-full w-5 h-5 flex items-center justify-center'
                            : isWeekend
                              ? dayOfWeek === 0 ? 'text-red-500' : 'text-blue-500'
                              : 'text-muted-foreground'
                        }`}
                      >
                        {date.getDate()}
                      </span>
                      {daySchedules.length > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          {t('workersCount', { count: daySchedules.length })}
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
                        <div className="text-[10px] text-muted-foreground pl-1">
                          {t('moreWorkers', { count: daySchedules.length - 3 })}
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
            <div className={TABLE_STYLES.wrapper}>
              <table className={TABLE_STYLES.table}>
                <thead className={TABLE_STYLES.header}>
                  <tr>
                    <th className={`sticky left-0 z-10 bg-background ${TABLE_STYLES.headerCell}`}>
                      {t('employee')}
                    </th>
                    {days.map(date => {
                      const dayOfWeek = date.getDay()
                      return (
                        <th
                          key={formatDateKey(date)}
                          className={`min-w-[44px] px-1 py-3 text-center text-xs font-medium ${
                            dayOfWeek === 0
                              ? 'text-red-500'
                              : dayOfWeek === 6
                                ? 'text-blue-500'
                                : 'text-muted-foreground'
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
                      <tr key={empId} className={TABLE_STYLES.row}>
                        <td className={`sticky left-0 z-10 bg-card ${TABLE_STYLES.cell} whitespace-nowrap`}>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-foreground">{emp.lastName}{emp.firstName}</span>
                            <span className="text-xs text-muted-foreground">{emp.employeeNumber}</span>
                          </div>
                        </td>
                        {days.map(date => {
                          const dateKey = formatDateKey(date)
                          const sched = schedMap.get(dateKey)

                          if (!sched) {
                            return <td key={dateKey} className="px-1 py-1 text-center border-t border-border">—</td>
                          }

                          return (
                            <td key={dateKey} className="px-1 py-1 text-center border-t border-border">
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
              <ArrowRightLeft className="h-5 w-5 text-orange-500" />
              {t('changeRequests', { count: changeRequests.length })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {changeRequests.map(req => {
                const st = REQUEST_STATUS_MAP[req.status] ?? REQUEST_STATUS_MAP.SCR_PENDING
                return (
                  <div
                    key={req.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-background/50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-sm">
                        <span className="font-medium">
                          {req.requester.lastName}{req.requester.firstName}
                        </span>
                        <span className="text-muted-foreground mx-2">→</span>
                        <span className="font-medium">
                          {req.targetEmployee.lastName}{req.targetEmployee.firstName}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {req.originalDate.split('T')[0]} ↔ {req.requestedDate.split('T')[0]}
                      </div>
                      <span className="text-xs text-muted-foreground">{req.reason}</span>
                    </div>
                    <StatusBadge status={req.status}>{t(st.labelKey)}</StatusBadge>
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
              <Calendar className="h-5 w-5 text-primary" />
              {t('dateSchedule', { date: selectedDate ?? '' })}
            </DialogTitle>
          </DialogHeader>

          {dateSchedules.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              {t('noScheduleForDate')}
            </div>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {dateSchedules.map(s => {
                const st = STATUS_MAP[s.status] ?? STATUS_MAP.SCHEDULED
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="inline-block h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ backgroundColor: s.shiftGroup.color }}
                      >
                        {s.shiftGroup.name.charAt(0)}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {s.employee.lastName}{s.employee.firstName}
                        </p>
                        <p className="text-xs text-muted-foreground">
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
                      <p className="text-xs text-muted-foreground mt-1">
                        {s.startTime} - {s.endTime}
                      </p>
                      <StatusBadge status={s.status} className="mt-1">{t(st.labelKey)}</StatusBadge>
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
