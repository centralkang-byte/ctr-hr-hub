// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Compensation Zod Schemas
// ═══════════════════════════════════════════════════════════

import { z } from 'zod'
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '@/lib/constants'

// ─── Salary Band ─────────────────────────────────────────

export const salaryBandSearchSchema = z.object({
  page: z.coerce.number().int().positive().default(DEFAULT_PAGE),
  limit: z.coerce.number().int().positive().max(100).default(DEFAULT_PAGE_SIZE),
  jobGradeId: z.string().uuid().optional(),
  jobCategoryId: z.string().uuid().optional(),
})

export const salaryBandCreateSchema = z
  .object({
    jobGradeId: z.string().uuid(),
    jobCategoryId: z.string().uuid().optional(),
    currency: z.string().max(3).default('KRW'),
    minSalary: z.number().positive(),
    midSalary: z.number().positive(),
    maxSalary: z.number().positive(),
    effectiveFrom: z.string().datetime(),
    effectiveTo: z.string().datetime().optional(),
  })
  .refine((d) => d.minSalary < d.midSalary && d.midSalary < d.maxSalary, {
    message: 'min < mid < max 순서여야 합니다.',
    path: ['midSalary'],
  })

export const salaryBandUpdateSchema = z
  .object({
    jobGradeId: z.string().uuid().optional(),
    jobCategoryId: z.string().uuid().optional(),
    currency: z.string().max(3).optional(),
    minSalary: z.number().positive().optional(),
    midSalary: z.number().positive().optional(),
    maxSalary: z.number().positive().optional(),
    effectiveFrom: z.string().datetime().optional(),
    effectiveTo: z.string().datetime().nullable().optional(),
  })

// ─── Salary Adjustment Matrix ────────────────────────────

export const matrixSearchSchema = z.object({
  cycleId: z.string().uuid().optional(),
})

export const matrixEntrySchema = z.object({
  emsBlock: z.string().min(1).max(4),
  recommendedIncreasePct: z.number().min(0).max(100),
  minIncreasePct: z.number().min(0).max(100).optional(),
  maxIncreasePct: z.number().min(0).max(100).optional(),
})

export const matrixUpsertSchema = z.object({
  cycleId: z.string().uuid().nullable(),
  entries: z.array(matrixEntrySchema).min(1).max(9),
})

export const matrixCopySchema = z.object({
  sourceCycleId: z.string().uuid(),
  targetCycleId: z.string().uuid(),
})

// ─── Compensation Simulation ─────────────────────────────

export const simulationSearchSchema = z.object({
  cycleId: z.string().uuid(),
  departmentId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(DEFAULT_PAGE),
  limit: z.coerce.number().int().positive().max(100).default(DEFAULT_PAGE_SIZE),
})

export const aiRecommendSchema = z.object({
  cycleId: z.string().uuid(),
  employeeId: z.string().uuid(),
  budgetConstraint: z.number().positive().optional(),
  companyAvgRaise: z.number().min(0).max(100).optional(),
})

// ─── Compensation Confirm ────────────────────────────────

export const compensationConfirmSchema = z.object({
  cycleId: z.string().uuid(),
  effectiveDate: z.string().datetime(),
  adjustments: z
    .array(
      z.object({
        employeeId: z.string().uuid(),
        newBaseSalary: z.number().positive(),
        changePct: z.number(),
        changeType: z
          .enum([
            'ANNUAL_INCREASE',
            'PROMOTION',
            'MARKET_ADJUSTMENT',
            'DEMOTION_COMP',
            'TRANSFER_COMP',
            'OTHER',
          ])
          .default('ANNUAL_INCREASE'),
        reason: z.string().optional(),
      }),
    )
    .min(1),
})

// ─── Compensation History ────────────────────────────────

export const historySearchSchema = z.object({
  employeeId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  changeType: z
    .enum([
      'HIRE',
      'ANNUAL_INCREASE',
      'PROMOTION',
      'MARKET_ADJUSTMENT',
      'DEMOTION_COMP',
      'TRANSFER_COMP',
      'OTHER',
    ])
    .optional(),
  page: z.coerce.number().int().positive().default(DEFAULT_PAGE),
  limit: z.coerce.number().int().positive().max(100).default(DEFAULT_PAGE_SIZE),
})

// ─── Compensation Analysis ───────────────────────────────

export const analysisSearchSchema = z.object({
  departmentId: z.string().uuid().optional(),
  jobGradeId: z.string().uuid().optional(),
})
