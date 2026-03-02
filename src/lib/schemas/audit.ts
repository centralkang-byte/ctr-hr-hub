// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Audit Log Zod Schemas
// ═══════════════════════════════════════════════════════════

import { z } from 'zod'
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '@/lib/constants'

// ─── Audit Log Search ────────────────────────────────────

export const auditLogSearchSchema = z.object({
  page: z.coerce.number().int().positive().default(DEFAULT_PAGE),
  limit: z.coerce.number().int().positive().max(100).default(DEFAULT_PAGE_SIZE),
  action: z.string().optional(),
  resourceType: z.string().optional(),
  actorId: z.string().uuid().optional(),
  sensitivityLevel: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
})

export type AuditLogSearchInput = z.infer<typeof auditLogSearchSchema>

// ─── Audit Log Export ────────────────────────────────────

export const auditLogExportSchema = z.object({
  action: z.string().optional(),
  resourceType: z.string().optional(),
  actorId: z.string().uuid().optional(),
  sensitivityLevel: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
})

export type AuditLogExportInput = z.infer<typeof auditLogExportSchema>

// ─── Audit Log Stats ────────────────────────────────────

export const auditLogStatsSchema = z.object({
  days: z.coerce.number().int().positive().max(365).default(30),
})

export type AuditLogStatsInput = z.infer<typeof auditLogStatsSchema>

// ─── Retention Policy ────────────────────────────────────

export const retentionPolicySchema = z.object({
  retentionDays: z.coerce.number().int().min(365).max(3650).default(730), // 2 years default, min 1 year
})

export type RetentionPolicyInput = z.infer<typeof retentionPolicySchema>
