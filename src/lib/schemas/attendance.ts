import { z } from 'zod'
import { paginationSchema } from './common'

// ================================================================
// Clock In / Out
// ================================================================
export const clockInSchema = z.object({
  method: z.enum(['WEB', 'MOBILE', 'TERMINAL', 'MANUAL']),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  terminalId: z.string().uuid().optional(),
  note: z.string().max(500).optional(),
})

export type ClockInInput = z.infer<typeof clockInSchema>

export const clockOutSchema = z.object({
  method: z.enum(['WEB', 'MOBILE', 'TERMINAL', 'MANUAL']),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  terminalId: z.string().uuid().optional(),
  note: z.string().max(500).optional(),
})

export type ClockOutInput = z.infer<typeof clockOutSchema>

// ================================================================
// Manual Correction (HR/Manager)
// ================================================================
export const attendanceCorrectionSchema = z.object({
  employeeId: z.string().uuid(),
  workDate: z.string().date(),
  clockIn: z.string().datetime().optional(),
  clockOut: z.string().datetime().optional(),
  workType: z.enum(['REGULAR', 'REMOTE', 'FIELD', 'BUSINESS_TRIP']).optional(),
  note: z.string().min(1, '사유를 입력해주세요').max(500),
})

export type AttendanceCorrectionInput = z.infer<typeof attendanceCorrectionSchema>

// ================================================================
// Attendance Search / Filter
// ================================================================
export const attendanceSearchSchema = paginationSchema.extend({
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  status: z.enum(['NORMAL', 'LATE', 'EARLY_OUT', 'ABSENT', 'ON_LEAVE', 'HOLIDAY']).optional(),
  departmentId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
})

export type AttendanceSearchInput = z.infer<typeof attendanceSearchSchema>
