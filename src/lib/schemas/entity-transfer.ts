// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Entity Transfer Zod Schemas (STEP 9-3)
// ═══════════════════════════════════════════════════════════

import { z } from 'zod'
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '@/lib/constants'

// ─── Transfer Create ─────────────────────────────────────

export const entityTransferCreateSchema = z.object({
  employeeId: z.string().uuid(),
  toCompanyId: z.string().uuid(),
  transferType: z.enum(['PERMANENT_TRANSFER', 'TEMPORARY_TRANSFER', 'SECONDMENT']),
  transferDate: z.string().date(),
  returnDate: z.string().date().optional(),
  newDepartmentId: z.string().uuid().optional(),
  newJobGradeId: z.string().uuid().optional(),
  newEmployeeNo: z.string().max(20).optional(),
  dataOptions: z.object({
    leavePolicy: z.enum(['CARRY_OVER', 'SETTLE']).default('CARRY_OVER'),
    tenurePolicy: z.enum(['GROUP_CONTINUOUS', 'ENTITY_RESET']).default('GROUP_CONTINUOUS'),
    performancePolicy: z.enum(['CARRY', 'ARCHIVE']).default('CARRY'),
  }).optional(),
})

export type EntityTransferCreateInput = z.infer<typeof entityTransferCreateSchema>

// ─── Transfer Approve ────────────────────────────────────

export const entityTransferApproveSchema = z.object({
  action: z.enum(['approve', 'reject']),
  cancellationReason: z.string().max(500).optional(),
})

export type EntityTransferApproveInput = z.infer<typeof entityTransferApproveSchema>

// ─── Transfer List Query ─────────────────────────────────

export const entityTransferListSchema = z.object({
  page: z.coerce.number().int().positive().default(DEFAULT_PAGE),
  limit: z.coerce.number().int().positive().max(100).default(DEFAULT_PAGE_SIZE),
  status: z.enum([
    'TRANSFER_REQUESTED', 'FROM_APPROVED', 'TO_APPROVED',
    'EXEC_APPROVED', 'TRANSFER_PROCESSING', 'TRANSFER_COMPLETED', 'TRANSFER_CANCELLED',
  ]).optional(),
  fromCompanyId: z.string().uuid().optional(),
  toCompanyId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
})

export type EntityTransferListInput = z.infer<typeof entityTransferListSchema>
