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
