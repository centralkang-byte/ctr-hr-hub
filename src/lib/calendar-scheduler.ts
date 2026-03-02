// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Graph Calendar API (Outlook + Teams)
// 면접관 빈시간 조회, 자동 스케줄링, Teams 미팅 링크 생성
// ═══════════════════════════════════════════════════════════

import { getGraphAccessToken } from '@/lib/microsoft-graph'
import { prisma } from '@/lib/prisma'

// ─── Types ──────────────────────────────────────────────────

export interface TimeSlot {
  start: string // ISO 8601
  end: string
}

interface FreeBusyScheduleItem {
  status: string
  start: { dateTime: string; timeZone: string }
  end: { dateTime: string; timeZone: string }
}

interface FreeBusyResponse {
  value: {
    scheduleId: string
    availabilityView: string
    scheduleItems: FreeBusyScheduleItem[]
  }[]
}

interface CalendarEventResponse {
  id: string
  subject: string
  onlineMeeting?: {
    joinUrl: string
  }
  webLink: string
}

// ─── Graph API Helpers ──────────────────────────────────────

async function graphFetch(path: string, options: RequestInit = {}) {
  const token = await getGraphAccessToken()
  return fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
}

// ─── Free/Busy 조회 ─────────────────────────────────────────

export async function getFreeBusy(
  userAadIds: string[],
  startTime: string,
  endTime: string,
  timeZone = 'Asia/Seoul',
): Promise<FreeBusyResponse> {
  const res = await graphFetch('/me/calendar/getSchedule', {
    method: 'POST',
    body: JSON.stringify({
      schedules: userAadIds,
      startTime: { dateTime: startTime, timeZone },
      endTime: { dateTime: endTime, timeZone },
      availabilityViewInterval: 30,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`FreeBusy 조회 실패: ${res.status} ${err}`)
  }

  return res.json() as Promise<FreeBusyResponse>
}

// ─── 빈시간 슬롯 계산 ──────────────────────────────────────

export function findCommonSlots(
  freeBusyData: FreeBusyResponse,
  durationMinutes: number,
  workStartHour = 9,
  workEndHour = 18,
): TimeSlot[] {
  if (freeBusyData.value.length === 0) return []

  const busySlots: TimeSlot[] = []
  for (const schedule of freeBusyData.value) {
    for (const item of schedule.scheduleItems) {
      if (item.status !== 'free') {
        busySlots.push({
          start: item.start.dateTime,
          end: item.end.dateTime,
        })
      }
    }
  }

  // Collect unique dates from the availability view
  const dates = new Set<string>()
  for (const schedule of freeBusyData.value) {
    for (const item of schedule.scheduleItems) {
      const d = item.start.dateTime.split('T')[0]
      dates.add(d)
    }
  }

  // If no busy items, generate slots from all work days
  // Use the start/end from the request timeframe
  const availableSlots: TimeSlot[] = []
  const durationMs = durationMinutes * 60 * 1000

  for (const dateStr of Array.from(dates).sort()) {
    let slotStart = new Date(`${dateStr}T${String(workStartHour).padStart(2, '0')}:00:00`)
    const dayEnd = new Date(`${dateStr}T${String(workEndHour).padStart(2, '0')}:00:00`)

    while (slotStart.getTime() + durationMs <= dayEnd.getTime()) {
      const slotEnd = new Date(slotStart.getTime() + durationMs)

      const overlaps = busySlots.some((busy) => {
        const busyStart = new Date(busy.start).getTime()
        const busyEnd = new Date(busy.end).getTime()
        return slotStart.getTime() < busyEnd && slotEnd.getTime() > busyStart
      })

      if (!overlaps) {
        availableSlots.push({
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
        })
      }

      // Advance by 30 minutes
      slotStart = new Date(slotStart.getTime() + 30 * 60 * 1000)
    }
  }

  return availableSlots
}

// ─── 영업일 계산 ───────────────────────────────────────────

export async function getNextBusinessDays(
  companyId: string,
  count: number,
): Promise<string[]> {
  const holidays = await prisma.holiday.findMany({
    where: {
      companyId,
      date: { gte: new Date() },
    },
    select: { date: true },
    orderBy: { date: 'asc' },
    take: 60,
  })

  const holidaySet = new Set(
    holidays.map((h) => h.date.toISOString().split('T')[0]),
  )

  const days: string[] = []
  const cursor = new Date()
  cursor.setDate(cursor.getDate() + 1) // Start from tomorrow

  while (days.length < count) {
    const dow = cursor.getDay()
    const dateStr = cursor.toISOString().split('T')[0]

    if (dow !== 0 && dow !== 6 && !holidaySet.has(dateStr)) {
      days.push(dateStr)
    }

    cursor.setDate(cursor.getDate() + 1)
  }

  return days
}

// ─── 캘린더 이벤트 생성 ────────────────────────────────────

export async function createCalendarEvent(
  organizerAadId: string,
  attendeeAadIds: string[],
  subject: string,
  start: string,
  end: string,
  isOnlineMeeting = true,
  timeZone = 'Asia/Seoul',
): Promise<CalendarEventResponse> {
  const attendees = attendeeAadIds.map((id) => ({
    emailAddress: { address: id },
    type: 'required' as const,
  }))

  const body: Record<string, unknown> = {
    subject,
    start: { dateTime: start, timeZone },
    end: { dateTime: end, timeZone },
    attendees,
    isOnlineMeeting,
    onlineMeetingProvider: isOnlineMeeting ? 'teamsForBusiness' : undefined,
  }

  const res = await graphFetch(`/users/${organizerAadId}/events`, {
    method: 'POST',
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`캘린더 이벤트 생성 실패: ${res.status} ${err}`)
  }

  return res.json() as Promise<CalendarEventResponse>
}

// ─── 캘린더 이벤트 수정 ────────────────────────────────────

export async function updateCalendarEvent(
  organizerAadId: string,
  eventId: string,
  updates: {
    subject?: string
    start?: string
    end?: string
    timeZone?: string
  },
): Promise<CalendarEventResponse> {
  const tz = updates.timeZone ?? 'Asia/Seoul'
  const body: Record<string, unknown> = {}
  if (updates.subject) body.subject = updates.subject
  if (updates.start) body.start = { dateTime: updates.start, timeZone: tz }
  if (updates.end) body.end = { dateTime: updates.end, timeZone: tz }

  const res = await graphFetch(`/users/${organizerAadId}/events/${eventId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`캘린더 이벤트 수정 실패: ${res.status} ${err}`)
  }

  return res.json() as Promise<CalendarEventResponse>
}

// ─── 캘린더 이벤트 취소 ────────────────────────────────────

export async function cancelCalendarEvent(
  organizerAadId: string,
  eventId: string,
  comment = '면접 일정이 취소되었습니다.',
): Promise<void> {
  const res = await graphFetch(
    `/users/${organizerAadId}/events/${eventId}/cancel`,
    {
      method: 'POST',
      body: JSON.stringify({ comment }),
    },
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`캘린더 이벤트 취소 실패: ${res.status} ${err}`)
  }
}
