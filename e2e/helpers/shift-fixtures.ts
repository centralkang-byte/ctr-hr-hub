// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Shift Pattern / Group / Schedule / Roster / Change Request Test Helpers
// Thin wrappers around ApiClient for shift module tests.
// ═══════════════════════════════════════════════════════════

import { ApiClient, type ApiResult } from './api-client'

const API = '/api/v1'

// ─── Shift Patterns ──────────────────────────────────────

export function listShiftPatterns(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${API}/shift-patterns`, params)
}

export function createShiftPattern(
  client: ApiClient,
  data: {
    code: string
    name: string
    patternType: string
    slots: Array<{ name: string; start: string; end: string; breakMin?: number; nightPremium?: boolean }>
    cycleDays: number
    weeklyHoursLimit?: number
    description?: string
  },
): Promise<ApiResult> {
  return client.post(`${API}/shift-patterns`, data)
}

export function getShiftPattern(client: ApiClient, id: string): Promise<ApiResult> {
  return client.get(`${API}/shift-patterns/${id}`)
}

export function updateShiftPattern(
  client: ApiClient,
  id: string,
  data: Record<string, unknown>,
): Promise<ApiResult> {
  return client.put(`${API}/shift-patterns/${id}`, data)
}

export function deleteShiftPattern(client: ApiClient, id: string): Promise<ApiResult> {
  return client.del(`${API}/shift-patterns/${id}`)
}

// ─── Shift Groups ────────────────────────────────────────
// NOTE: No detail/update/delete routes exist — only list, create, member management

export function listShiftGroups(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${API}/shift-groups`, params)
}

export function createShiftGroup(
  client: ApiClient,
  data: { shiftPatternId: string; name: string; color?: string },
): Promise<ApiResult> {
  return client.post(`${API}/shift-groups`, data)
}

export function getShiftGroupMembers(client: ApiClient, groupId: string): Promise<ApiResult> {
  return client.get(`${API}/shift-groups/${groupId}/members`)
}

export function assignShiftGroupMembers(
  client: ApiClient,
  groupId: string,
  employeeIds: string[],
): Promise<ApiResult> {
  return client.put(`${API}/shift-groups/${groupId}/members`, {
    shiftGroupId: groupId,
    employeeIds,
  })
}

// ─── Shift Schedules ─────────────────────────────────────

export function getMonthlySchedules(
  client: ApiClient,
  year: number,
  month: number,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${API}/shift-schedules/${year}/${month}`, params)
}

export function generateSchedules(
  client: ApiClient,
  data: { shiftPatternId: string; year: number; month: number; shiftGroupId?: string },
): Promise<ApiResult> {
  return client.post(`${API}/shift-schedules/generate`, data)
}

// ─── Shift Roster ────────────────────────────────────────

export function getMonthlyRoster(
  client: ApiClient,
  year: number,
  month: number,
): Promise<ApiResult> {
  return client.get(`${API}/shift-roster/${year}/${month}`)
}

export function assignRoster(
  client: ApiClient,
  data: {
    employeeId: string
    scheduleId: string
    shiftGroup?: string
    effectiveFrom: string
    effectiveTo?: string
  },
): Promise<ApiResult> {
  return client.put(`${API}/shift-roster/assign`, data)
}

export function getRosterWarnings(client: ApiClient): Promise<ApiResult> {
  return client.get(`${API}/shift-roster/warnings`)
}

// ─── Change Requests ─────────────────────────────────────

export function listChangeRequests(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${API}/shift-change-requests`, params)
}

export function createChangeRequest(
  client: ApiClient,
  data: {
    originalDate: string
    originalSlotIndex: number
    reason: string
    targetEmployeeId?: string
    requestedDate?: string
    requestedSlotIndex?: number
  },
): Promise<ApiResult> {
  return client.post(`${API}/shift-change-requests`, data)
}

export function approveChangeRequest(
  client: ApiClient,
  id: string,
  action: 'approve' | 'reject',
  rejectionReason?: string,
): Promise<ApiResult> {
  return client.put(`${API}/shift-change-requests/${id}/approve`, {
    action,
    ...(rejectionReason ? { rejectionReason } : {}),
  })
}

// ─── Attendance Shift Board (listShifts already in attendance-fixtures.ts) ─

export function upsertShiftCell(
  client: ApiClient,
  data: {
    employeeId: string
    workDate: string
    slotName: 'morning' | 'night' | 'off'
    startTime?: string
    endTime?: string
    note?: string
  },
): Promise<ApiResult> {
  return client.post(`${API}/attendance/shifts`, data)
}

// ─── Employee Schedules ──────────────────────────────────

export function getEmployeeSchedules(
  client: ApiClient,
  employeeId: string,
): Promise<ApiResult> {
  return client.get(`${API}/employees/${employeeId}/schedules`)
}

export function assignEmployeeSchedule(
  client: ApiClient,
  employeeId: string,
  data: { scheduleId: string; shiftGroup?: string; effectiveFrom: string; effectiveTo?: string },
): Promise<ApiResult> {
  return client.post(`${API}/employees/${employeeId}/schedules`, {
    employeeId,
    ...data,
  })
}

// ─── Test Data Builders ──────────────────────────────────

/** TWO_SHIFT pattern payload: DAY (06:00-18:00) + NIGHT (18:00-06:00), 14-day cycle */
export function buildTwoShiftPattern(prefix: string) {
  return {
    code: `${prefix}-2S-${Date.now()}`.slice(0, 20),
    name: `E2E Two-Shift ${prefix}`,
    patternType: 'TWO_SHIFT' as const,
    slots: [
      { name: 'DAY', start: '06:00', end: '18:00', breakMin: 60, nightPremium: false },
      { name: 'NIGHT', start: '18:00', end: '06:00', breakMin: 60, nightPremium: true },
    ],
    cycleDays: 14,
    weeklyHoursLimit: 52,
  }
}

/** THREE_SHIFT pattern payload: DAY + SWING + NIGHT, 21-day cycle */
export function buildThreeShiftPattern(prefix: string) {
  return {
    code: `${prefix}-3S-${Date.now()}`.slice(0, 20),
    name: `E2E Three-Shift ${prefix}`,
    patternType: 'THREE_SHIFT' as const,
    slots: [
      { name: 'DAY', start: '06:00', end: '14:00', breakMin: 30, nightPremium: false },
      { name: 'SWING', start: '14:00', end: '22:00', breakMin: 30, nightPremium: false },
      { name: 'NIGHT', start: '22:00', end: '06:00', breakMin: 30, nightPremium: true },
    ],
    cycleDays: 21,
    weeklyHoursLimit: 52,
  }
}
