// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Migration Zod Schemas
// 데이터 마이그레이션 도구 스키마
// ═══════════════════════════════════════════════════════════

import { z } from 'zod'
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '@/lib/constants'

// ─── Enums ──────────────────────────────────────────────────

const sourceTypeEnum = z.enum(['CSV', 'EXCEL', 'JSON', 'API'])
const dataScopeEnum = z.enum(['EMPLOYEES', 'ATTENDANCE', 'PAYROLL', 'LEAVE', 'PERFORMANCE', 'ALL'])
const jobStatusEnum = z.enum(['DRAFT', 'VALIDATING', 'VALIDATED', 'RUNNING', 'COMPLETED', 'FAILED', 'ROLLED_BACK'])
const transformEnum = z.enum(['uppercase', 'lowercase', 'date_iso', 'trim', 'number'])

// ─── Migration Job Create ───────────────────────────────────

export const migrationJobCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  sourceType: sourceTypeEnum,
  dataScope: dataScopeEnum,
  config: z.object({
    fieldMappings: z.array(z.object({
      sourceField: z.string(),
      targetField: z.string(),
      transform: transformEnum.optional(),
    })).optional(),
    skipDuplicates: z.boolean().default(true),
    dryRun: z.boolean().default(false),
  }).optional(),
})

// ─── Migration Job List ─────────────────────────────────────

export const migrationJobListSchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(100).default(DEFAULT_PAGE_SIZE),
  status: jobStatusEnum.optional(),
  dataScope: dataScopeEnum.optional(),
})

// ─── Migration Validate ─────────────────────────────────────

export const migrationValidateSchema = z.object({
  data: z.array(z.record(z.string(), z.unknown())).min(1),
})

// ─── Migration Execute ──────────────────────────────────────

export const migrationExecuteSchema = z.object({
  data: z.array(z.record(z.string(), z.unknown())).min(1),
})
