import { z } from 'zod'

export const bankTransferBatchCreateSchema = z.object({
  payrollRunId: z.string().uuid().optional(),
  bankCode: z.string().min(1).max(20),
  bankName: z.string().min(1).max(100),
  format: z.enum(['CSV', 'XML', 'EBCDIC']).default('CSV'),
  note: z.string().max(500).optional().nullable(),
})

export const bankTransferBatchListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['DRAFT', 'GENERATING', 'GENERATED', 'SUBMITTED', 'PARTIALLY_COMPLETED', 'COMPLETED', 'FAILED']).optional(),
  bankCode: z.string().optional(),
})

export const bankTransferResultUploadSchema = z.object({
  results: z.array(z.object({
    employeeId: z.string().uuid(),
    status: z.enum(['SUCCESS', 'FAILED', 'CANCELLED']),
    errorMessage: z.string().optional().nullable(),
    transferredAt: z.string().datetime().optional(),
  })),
})
