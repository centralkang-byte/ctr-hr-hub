// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Payroll Zod Schemas
// ═══════════════════════════════════════════════════════════

import { z } from 'zod'
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '@/lib/constants'

// ─── PayrollRun List Query ──────────────────────────────

export const payrollRunListSchema = z.object({
  page: z.coerce.number().int().positive().default(DEFAULT_PAGE),
  limit: z.coerce.number().int().positive().max(100).default(DEFAULT_PAGE_SIZE),
  status: z
    .enum(['DRAFT', 'CALCULATING', 'REVIEW', 'APPROVED', 'PAID', 'CANCELLED'])
    .optional(),
  runType: z.enum(['MONTHLY', 'BONUS', 'SEVERANCE', 'SPECIAL']).optional(),
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
})

// ─── PayrollRun Create ──────────────────────────────────

export const payrollRunCreateSchema = z.object({
  name: z.string().min(1).max(100),
  runType: z.enum(['MONTHLY', 'BONUS', 'SEVERANCE', 'SPECIAL']).default('MONTHLY'),
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/, 'YYYY-MM 형식이어야 합니다.'),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  payDate: z.string().datetime().optional(),
  currency: z.string().max(3).default('KRW'),
})

// ─── PayrollItem Adjust ─────────────────────────────────

export const payrollItemAdjustSchema = z.object({
  baseSalary: z.number().nonnegative().optional(),
  overtimePay: z.number().nonnegative().optional(),
  bonus: z.number().nonnegative().optional(),
  allowances: z.number().nonnegative().optional(),
  deductions: z.number().nonnegative().optional(),
  adjustmentReason: z.string().min(1, '조정 사유를 입력하세요.'),
})

// ─── Severance Calculation ──────────────────────────────

export const payrollSeveranceSchema = z.object({
  terminationDate: z.string().datetime(),
})

// ─── AI Anomaly Check ───────────────────────────────────

export const payrollAnomalySchema = z.object({
  runId: z.string().uuid(),
})
