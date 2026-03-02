// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Gender Pay Gap Analytics Schema
// ═══════════════════════════════════════════════════════════

import { z } from 'zod'

export const genderPayGapQuerySchema = z.object({
  groupBy: z.enum(['jobGrade', 'jobCategory', 'department']).default('jobGrade'),
  year: z.coerce.number().int().optional(),
})

export type GenderPayGapQuery = z.infer<typeof genderPayGapQuerySchema>
