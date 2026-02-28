import { z } from 'zod'

export const managerSummarySchema = z.object({
  departmentId: z.string().uuid().optional(),
})

export const managerAlertsSchema = z.object({
  departmentId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(20).default(10),
})

export const managerPerformanceSchema = z.object({
  departmentId: z.string().uuid().optional(),
  cycleId: z.string().uuid().optional(),
})
