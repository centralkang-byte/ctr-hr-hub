// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Analytics Zod Schemas
// ═══════════════════════════════════════════════════════════

import { z } from 'zod'

const GROUP_ALL = '__GROUP_ALL__'

// ─── Common Analytics Query ──────────────────────────────

export const analyticsQuerySchema = z.object({
  company_id: z
    .string()
    .optional()
    .transform((v) => (v === GROUP_ALL ? undefined : v)),
})

// ─── Performance Query (with optional cycle) ─────────────

export const performanceQuerySchema = analyticsQuerySchema.extend({
  cycle_id: z.string().uuid().optional(),
})

// ─── Attendance Query (with weeks) ───────────────────────

export const attendanceQuerySchema = analyticsQuerySchema.extend({
  weeks: z.coerce.number().int().min(4).max(52).default(12),
})

// ─── Turnover Query (with months) ────────────────────────

export const turnoverQuerySchema = analyticsQuerySchema.extend({
  months: z.coerce.number().int().min(3).max(24).default(12),
})

// ─── AI Report Generate ─────────────────────────────────

export const aiReportGenerateSchema = z.object({
  company_id: z
    .string()
    .optional()
    .transform((v) => (v === GROUP_ALL ? undefined : v)),
})
