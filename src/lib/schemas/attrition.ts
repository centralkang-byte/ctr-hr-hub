// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Attrition Risk Zod Schemas
// ═══════════════════════════════════════════════════════════

import { z } from 'zod'
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '@/lib/constants'

// ─── Dashboard ───────────────────────────────────────────

export const attritionDashboardSchema = z.object({
  departmentId: z.string().uuid().optional(),
})

// ─── Employee Detail ─────────────────────────────────────

export const attritionEmployeeSchema = z.object({
  page: z.coerce.number().int().positive().default(DEFAULT_PAGE),
  limit: z.coerce.number().int().positive().max(100).default(DEFAULT_PAGE_SIZE),
})

// ─── Trend ───────────────────────────────────────────────

export const attritionTrendSchema = z.object({
  months: z.coerce.number().int().min(3).max(24).default(12),
  departmentId: z.string().uuid().optional(),
})

// ─── Recalculate ─────────────────────────────────────────

export const attritionRecalculateSchema = z.object({
  employeeId: z.string().uuid().optional(),
})
