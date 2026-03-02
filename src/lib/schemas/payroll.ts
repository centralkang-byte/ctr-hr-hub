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

// ═══════════════════════════════════════════════════════════
// STEP 9-3: 수당/공제 항목 마스터
// ═══════════════════════════════════════════════════════════

// ─── Allowance Type CRUD ─────────────────────────────────

export const payAllowanceTypeCreateSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  category: z.enum(['FIXED', 'VARIABLE', 'INCENTIVE']),
  isTaxExempt: z.boolean().default(false),
  taxExemptLimit: z.number().nonnegative().optional(),
  isIncludedInAnnual: z.boolean().default(true),
  calculationMethod: z.enum(['FIXED_AMOUNT', 'RATE', 'FORMULA']).default('FIXED_AMOUNT'),
  defaultAmount: z.number().nonnegative().optional(),
  description: z.string().max(500).optional(),
  sortOrder: z.number().int().default(0),
})

export type PayAllowanceTypeCreateInput = z.infer<typeof payAllowanceTypeCreateSchema>
export const payAllowanceTypeUpdateSchema = payAllowanceTypeCreateSchema.partial()

export const payAllowanceTypeListSchema = z.object({
  page: z.coerce.number().int().positive().default(DEFAULT_PAGE),
  limit: z.coerce.number().int().positive().max(100).default(DEFAULT_PAGE_SIZE),
  category: z.enum(['FIXED', 'VARIABLE', 'INCENTIVE']).optional(),
  isActive: z.coerce.boolean().optional(),
})

// ─── Deduction Type CRUD ─────────────────────────────────

export const payDeductionTypeCreateSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  category: z.enum(['STATUTORY', 'VOLUNTARY']),
  countryCode: z.string().max(2).optional(),
  calculationMethod: z.enum(['FIXED_AMOUNT', 'RATE', 'FORMULA', 'BRACKET']).default('FIXED_AMOUNT'),
  rate: z.number().min(0).max(100).optional(),
  description: z.string().max(500).optional(),
  sortOrder: z.number().int().default(0),
})

export type PayDeductionTypeCreateInput = z.infer<typeof payDeductionTypeCreateSchema>
export const payDeductionTypeUpdateSchema = payDeductionTypeCreateSchema.partial()

export const payDeductionTypeListSchema = z.object({
  page: z.coerce.number().int().positive().default(DEFAULT_PAGE),
  limit: z.coerce.number().int().positive().max(100).default(DEFAULT_PAGE_SIZE),
  category: z.enum(['STATUTORY', 'VOLUNTARY']).optional(),
  isActive: z.coerce.boolean().optional(),
})

// ─── Employee Pay Items ──────────────────────────────────

export const employeePayItemCreateSchema = z.object({
  employeeId: z.string().uuid(),
  itemType: z.enum(['ALLOWANCE', 'DEDUCTION']),
  allowanceTypeId: z.string().uuid().optional(),
  deductionTypeId: z.string().uuid().optional(),
  amount: z.number(),
  currency: z.string().max(3).default('KRW'),
  effectiveFrom: z.string().date(),
  effectiveTo: z.string().date().optional(),
  note: z.string().max(500).optional(),
}).refine(
  (data) => {
    if (data.itemType === 'ALLOWANCE') return !!data.allowanceTypeId
    if (data.itemType === 'DEDUCTION') return !!data.deductionTypeId
    return false
  },
  { message: '수당 항목이면 allowanceTypeId, 공제 항목이면 deductionTypeId가 필요합니다' },
)

export type EmployeePayItemCreateInput = z.infer<typeof employeePayItemCreateSchema>

export const employeePayItemListSchema = z.object({
  employeeId: z.string().uuid().optional(),
  itemType: z.enum(['ALLOWANCE', 'DEDUCTION']).optional(),
  page: z.coerce.number().int().positive().default(DEFAULT_PAGE),
  limit: z.coerce.number().int().positive().max(100).default(DEFAULT_PAGE_SIZE),
})
