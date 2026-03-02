import { z } from 'zod'
import { paginationSchema } from './common'

// ================================================================
// Work Schedule CRUD
// ================================================================
const dailyConfigSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'HH:mm 형식'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'HH:mm 형식'),
  isWorkday: z.boolean(),
})

export const workScheduleCreateSchema = z.object({
  name: z.string().min(1, '스케줄명은 필수입니다').max(100),
  scheduleType: z.enum(['STANDARD', 'FLEXIBLE', 'DISCRETIONARY', 'REMOTE', 'SHIFT_2', 'SHIFT_3']),
  weeklyHours: z.number().min(0).max(168),
  dailyConfig: z.array(dailyConfigSchema).length(7, '7일 설정이 필요합니다'),
  shiftConfig: z
    .object({
      shiftGroups: z.array(
        z.object({
          name: z.string().min(1).max(50),
          startTime: z.string().regex(/^\d{2}:\d{2}$/),
          endTime: z.string().regex(/^\d{2}:\d{2}$/),
        }),
      ),
    })
    .optional(),
})

export type WorkScheduleCreateInput = z.infer<typeof workScheduleCreateSchema>

export const workScheduleUpdateSchema = workScheduleCreateSchema.partial()

export type WorkScheduleUpdateInput = z.infer<typeof workScheduleUpdateSchema>

// ================================================================
// Employee Schedule Assignment
// ================================================================
export const employeeScheduleAssignSchema = z.object({
  employeeId: z.string().uuid(),
  scheduleId: z.string().uuid(),
  shiftGroup: z.string().max(50).optional(),
  effectiveFrom: z.string().date(),
  effectiveTo: z.string().date().optional(),
})

export type EmployeeScheduleAssignInput = z.infer<typeof employeeScheduleAssignSchema>

// ================================================================
// Bulk Assignment (shift roster)
// ================================================================
export const shiftRosterBulkSchema = z.object({
  scheduleId: z.string().uuid(),
  assignments: z
    .array(
      z.object({
        employeeId: z.string().uuid(),
        shiftGroup: z.string().max(50),
        effectiveFrom: z.string().date(),
        effectiveTo: z.string().date().optional(),
      }),
    )
    .min(1, '최소 1명의 직원을 지정하세요'),
})

export type ShiftRosterBulkInput = z.infer<typeof shiftRosterBulkSchema>

// ================================================================
// Work Schedule Search
// ================================================================
export const workScheduleSearchSchema = paginationSchema.extend({
  scheduleType: z.enum(['STANDARD', 'FLEXIBLE', 'DISCRETIONARY', 'REMOTE', 'SHIFT_2', 'SHIFT_3']).optional(),
})

export type WorkScheduleSearchInput = z.infer<typeof workScheduleSearchSchema>

// ================================================================
// STEP 9-3: Shift Pattern CRUD
// ================================================================

const shiftSlotSchema = z.object({
  name: z.string().min(1).max(50),
  start: z.string().regex(/^\d{2}:\d{2}$/, 'HH:mm 형식'),
  end: z.string().regex(/^\d{2}:\d{2}$/, 'HH:mm 형식'),
  breakMin: z.number().int().min(0).default(60),
  nightPremium: z.boolean().default(false),
})

export const shiftPatternCreateSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  patternType: z.enum(['TWO_SHIFT', 'THREE_SHIFT', 'DAY_NIGHT_OFF', 'FOUR_ON_TWO_OFF', 'CUSTOM']),
  slots: z.array(shiftSlotSchema).min(1, '최소 1개 슬롯이 필요합니다'),
  cycleDays: z.number().int().min(1).max(365),
  weeklyHoursLimit: z.number().min(0).max(168).optional(),
  description: z.string().max(500).optional(),
})

export type ShiftPatternCreateInput = z.infer<typeof shiftPatternCreateSchema>

export const shiftPatternUpdateSchema = shiftPatternCreateSchema.partial()
export type ShiftPatternUpdateInput = z.infer<typeof shiftPatternUpdateSchema>

export const shiftPatternSearchSchema = paginationSchema.extend({
  patternType: z.enum(['TWO_SHIFT', 'THREE_SHIFT', 'DAY_NIGHT_OFF', 'FOUR_ON_TWO_OFF', 'CUSTOM']).optional(),
  isActive: z.coerce.boolean().optional(),
})

// ================================================================
// Shift Group CRUD
// ================================================================

export const shiftGroupCreateSchema = z.object({
  shiftPatternId: z.string().uuid(),
  name: z.string().min(1).max(50),
  color: z.string().max(7).optional(),
})

export type ShiftGroupCreateInput = z.infer<typeof shiftGroupCreateSchema>

export const shiftGroupMemberSchema = z.object({
  shiftGroupId: z.string().uuid(),
  employeeIds: z.array(z.string().uuid()).min(1),
})

export type ShiftGroupMemberInput = z.infer<typeof shiftGroupMemberSchema>

// ================================================================
// Shift Schedule
// ================================================================

export const shiftScheduleQuerySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  shiftPatternId: z.string().uuid().optional(),
  shiftGroupId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
})

export type ShiftScheduleQueryInput = z.infer<typeof shiftScheduleQuerySchema>

export const shiftScheduleGenerateSchema = z.object({
  shiftPatternId: z.string().uuid(),
  shiftGroupId: z.string().uuid().optional(),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
})

export type ShiftScheduleGenerateInput = z.infer<typeof shiftScheduleGenerateSchema>

// ================================================================
// Shift Change Request
// ================================================================

export const shiftChangeRequestCreateSchema = z.object({
  targetEmployeeId: z.string().uuid().optional(),
  originalDate: z.string().date(),
  requestedDate: z.string().date().optional(),
  originalSlotIndex: z.number().int().min(0),
  requestedSlotIndex: z.number().int().min(0).optional(),
  reason: z.string().min(1).max(500),
})

export type ShiftChangeRequestCreateInput = z.infer<typeof shiftChangeRequestCreateSchema>

export const shiftChangeRequestActionSchema = z.object({
  rejectionReason: z.string().max(500).optional(),
})

export type ShiftChangeRequestActionInput = z.infer<typeof shiftChangeRequestActionSchema>
