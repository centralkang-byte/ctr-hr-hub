// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Succession Planning Zod Schemas
// ═══════════════════════════════════════════════════════════

import { z } from 'zod'
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '@/lib/constants'

// ─── Succession Plan ────────────────────────────────────

export const planSearchSchema = z.object({
  page: z.coerce.number().int().positive().default(DEFAULT_PAGE),
  limit: z.coerce.number().int().positive().max(100).default(DEFAULT_PAGE_SIZE),
  criticality: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  status: z.enum(['PLAN_DRAFT', 'PLAN_ACTIVE', 'ARCHIVED']).optional(),
  departmentId: z.string().uuid().optional(),
})

export const planCreateSchema = z.object({
  positionTitle: z.string().min(1).max(200),
  departmentId: z.string().uuid().optional(),
  currentHolderId: z.string().uuid().optional(),
  criticality: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  notes: z.string().max(2000).optional(),
})

export const planUpdateSchema = z.object({
  positionTitle: z.string().min(1).max(200).optional(),
  departmentId: z.string().uuid().nullable().optional(),
  currentHolderId: z.string().uuid().nullable().optional(),
  criticality: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  status: z.enum(['PLAN_DRAFT', 'PLAN_ACTIVE', 'ARCHIVED']).optional(),
  notes: z.string().max(2000).nullable().optional(),
})

// ─── Succession Candidate ───────────────────────────────

export const candidateAddSchema = z.object({
  employeeId: z.string().uuid(),
  readiness: z.enum(['READY_NOW', 'READY_1_2_YEARS', 'READY_3_PLUS_YEARS']),
  developmentAreas: z.any().optional(),
  notes: z.string().max(2000).optional(),
})

export const candidateUpdateSchema = z.object({
  readiness: z.enum(['READY_NOW', 'READY_1_2_YEARS', 'READY_3_PLUS_YEARS']).optional(),
  developmentAreas: z.any().optional(),
  notes: z.string().max(2000).nullable().optional(),
})
