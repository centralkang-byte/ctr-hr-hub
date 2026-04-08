// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Attendance / Holiday / Work-Schedule Test Helpers
// Thin wrappers around ApiClient for attendance module tests.
// ═══════════════════════════════════════════════════════════

import { ApiClient, type ApiResult } from './api-client'

const API = '/api/v1'

// ─── Attendance (Clock-in/out, Today, Summary) ─────────────

export function clockIn(
  client: ApiClient,
  opts?: { method?: string; note?: string },
): Promise<ApiResult> {
  return client.post(`${API}/attendance/clock-in`, {
    method: opts?.method ?? 'WEB',
    ...(opts?.note ? { note: opts.note } : {}),
  })
}

export function clockOut(
  client: ApiClient,
  opts?: { method?: string; note?: string },
): Promise<ApiResult> {
  return client.post(`${API}/attendance/clock-out`, {
    method: opts?.method ?? 'WEB',
    ...(opts?.note ? { note: opts.note } : {}),
  })
}

export function getTodayAttendance(client: ApiClient): Promise<ApiResult> {
  return client.get(`${API}/attendance/today`)
}

export function getWeeklySummary(client: ApiClient): Promise<ApiResult> {
  return client.get(`${API}/attendance/weekly-summary`)
}

export function getMonthlyAttendance(
  client: ApiClient,
  year: number,
  month: number,
): Promise<ApiResult> {
  return client.get(`${API}/attendance/monthly/${year}/${month}`)
}

// ─── Attendance Admin ──────────────────────────────────────

export function getAdminAttendance(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${API}/attendance/admin`, params)
}

export function getTeamAttendance(client: ApiClient): Promise<ApiResult> {
  return client.get(`${API}/attendance/team`)
}

export function getAttendanceDetail(
  client: ApiClient,
  id: string,
): Promise<ApiResult> {
  return client.get(`${API}/attendance/${id}`)
}

export function correctAttendance(
  client: ApiClient,
  id: string,
  data: { note: string; clockIn?: string; clockOut?: string; workType?: string; status?: string },
): Promise<ApiResult> {
  return client.put(`${API}/attendance/${id}`, data)
}

export function getEmployeeAttendance(
  client: ApiClient,
  employeeId: string,
): Promise<ApiResult> {
  return client.get(`${API}/attendance/employees/${employeeId}`)
}

export function listShifts(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${API}/attendance/shifts`, params)
}

// ─── Holidays ──────────────────────────────────────────────

export function listHolidays(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${API}/holidays`, params)
}

export function getHoliday(client: ApiClient, id: string): Promise<ApiResult> {
  return client.get(`${API}/holidays/${id}`)
}

export function createHoliday(
  client: ApiClient,
  data: { name: string; date: string; year: number; isSubstitute?: boolean },
): Promise<ApiResult> {
  return client.post(`${API}/holidays`, data)
}

export function updateHoliday(
  client: ApiClient,
  id: string,
  data: { name?: string; date?: string; isSubstitute?: boolean },
): Promise<ApiResult> {
  return client.put(`${API}/holidays/${id}`, data)
}

export function deleteHoliday(
  client: ApiClient,
  id: string,
): Promise<ApiResult> {
  return client.del(`${API}/holidays/${id}`)
}

// ─── Work Schedules ────────────────────────────────────────

export function listWorkSchedules(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${API}/work-schedules`, params)
}

export function getWorkSchedule(
  client: ApiClient,
  id: string,
): Promise<ApiResult> {
  return client.get(`${API}/work-schedules/${id}`)
}

export function createWorkSchedule(
  client: ApiClient,
  data: {
    name: string
    scheduleType: string
    weeklyHours: number
    dailyConfig: Array<{
      dayOfWeek: number
      startTime: string
      endTime: string
      isWorkday: boolean
    }>
  },
): Promise<ApiResult> {
  return client.post(`${API}/work-schedules`, data)
}

export function updateWorkSchedule(
  client: ApiClient,
  id: string,
  data: Record<string, unknown>,
): Promise<ApiResult> {
  return client.put(`${API}/work-schedules/${id}`, data)
}

export function deleteWorkSchedule(
  client: ApiClient,
  id: string,
): Promise<ApiResult> {
  return client.del(`${API}/work-schedules/${id}`)
}

// ─── Test Data Builders ────────────────────────────────────

/** Standard 7-day config (Mon-Fri 09:00-18:00, Sat-Sun off) */
export function buildStandardDailyConfig() {
  return Array.from({ length: 7 }, (_, i) => ({
    dayOfWeek: i,
    startTime: i >= 1 && i <= 5 ? '09:00' : '00:00',
    endTime: i >= 1 && i <= 5 ? '18:00' : '00:00',
    isWorkday: i >= 1 && i <= 5,
  }))
}

/**
 * Generate a unique future holiday date string (YYYY-MM-DD) for test isolation.
 * Uses worker-relative day offset within 2028 to avoid collisions
 * across repeated test runs and parallel workers.
 * Uses manual string formatting to avoid UTC timezone shift (Codex P2).
 */
export function futureHolidayDate(offsetDays = 0): string {
  const baseDayOfYear = (Date.now() % 300) + 1 // 1–300
  const day = ((baseDayOfYear + offsetDays) % 365) + 1
  const d = new Date(2028, 0, day) // local time, not UTC
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}
