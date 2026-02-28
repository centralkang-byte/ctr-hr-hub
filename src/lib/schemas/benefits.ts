// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Benefits Zod Schemas
// ═══════════════════════════════════════════════════════════

import { z } from 'zod'
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '@/lib/constants'

// ─── Benefit Policy ─────────────────────────────────────

export const benefitPolicySearchSchema = z.object({
  page: z.coerce.number().int().positive().default(DEFAULT_PAGE),
  limit: z.coerce.number().int().positive().max(100).default(DEFAULT_PAGE_SIZE),
  category: z.enum(['MEAL', 'TRANSPORT', 'EDUCATION', 'HEALTH', 'HOUSING', 'CHILDCARE', 'OTHER']).optional(),
  isActive: z.coerce.boolean().optional(),
})

export const benefitPolicyCreateSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.enum(['MEAL', 'TRANSPORT', 'EDUCATION', 'HEALTH', 'HOUSING', 'CHILDCARE', 'OTHER']),
  amount: z.number().positive().optional(),
  frequency: z.enum(['MONTHLY', 'QUARTERLY', 'ANNUAL', 'ONE_TIME']),
  currency: z.string().max(3).default('KRW'),
  eligibilityRules: z.any().optional(),
  isTaxable: z.boolean().default(true),
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().nullable().optional(),
})

export const benefitPolicyUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  category: z.enum(['MEAL', 'TRANSPORT', 'EDUCATION', 'HEALTH', 'HOUSING', 'CHILDCARE', 'OTHER']).optional(),
  amount: z.number().positive().nullable().optional(),
  frequency: z.enum(['MONTHLY', 'QUARTERLY', 'ANNUAL', 'ONE_TIME']).optional(),
  currency: z.string().max(3).optional(),
  eligibilityRules: z.any().optional(),
  isTaxable: z.boolean().optional(),
  isActive: z.boolean().optional(),
  effectiveFrom: z.string().datetime().optional(),
  effectiveTo: z.string().datetime().nullable().optional(),
})

// ─── Benefit Enrollment ─────────────────────────────────

export const enrollmentSearchSchema = z.object({
  page: z.coerce.number().int().positive().default(DEFAULT_PAGE),
  limit: z.coerce.number().int().positive().max(100).default(DEFAULT_PAGE_SIZE),
  policyId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'EXPIRED']).optional(),
})

export const enrollmentCreateSchema = z.object({
  employeeId: z.string().uuid(),
  policyId: z.string().uuid(),
  note: z.string().max(500).optional(),
})

export const enrollmentUpdateSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'EXPIRED']),
  note: z.string().max(500).optional(),
  expiredAt: z.string().datetime().nullable().optional(),
})
