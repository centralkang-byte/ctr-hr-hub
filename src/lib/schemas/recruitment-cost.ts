// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Recruitment Cost Zod Schemas
// ═══════════════════════════════════════════════════════════

import { z } from 'zod'
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '@/lib/constants'

// ─── Shared Enums ────────────────────────────────────────

const applicantSourceEnum = z.enum(['DIRECT', 'REFERRAL', 'AGENCY', 'JOB_BOARD', 'INTERNAL'])

const costTypeEnum = z.enum([
  'AD_FEE',
  'AGENCY_FEE',
  'REFERRAL_BONUS',
  'ASSESSMENT_TOOL',
  'TRAVEL',
  'RELOCATION',
  'SIGNING_BONUS',
  'OTHER',
])

// ─── Create ──────────────────────────────────────────────

export const recruitmentCostCreateSchema = z.object({
  postingId: z.string().uuid().optional().nullable(),
  applicantSource: applicantSourceEnum,
  costType: costTypeEnum,
  amount: z.number().min(0),
  currency: z.string().default('KRW'),
  description: z.string().max(500).optional().nullable(),
  vendorName: z.string().max(200).optional().nullable(),
  invoiceDate: z.string().date().optional().nullable(),
})

// ─── Update (all fields partial) ─────────────────────────

export const recruitmentCostUpdateSchema = recruitmentCostCreateSchema.partial()

// ─── List / Search ───────────────────────────────────────

export const recruitmentCostListSchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(100).default(DEFAULT_PAGE_SIZE),
  postingId: z.string().uuid().optional(),
  applicantSource: applicantSourceEnum.optional(),
  costType: costTypeEnum.optional(),
})

// ─── Cost Analysis Query ─────────────────────────────────

export const costAnalysisQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
})
