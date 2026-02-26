import { z } from 'zod'

// ================================================================
// Pagination
// ================================================================
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type PaginationInput = z.infer<typeof paginationSchema>

// ================================================================
// UUID
// ================================================================
export const uuidSchema = z.string().uuid()

// ================================================================
// Date Range
// ================================================================
export const dateRangeSchema = z
  .object({
    startDate: z.string().date(),
    endDate: z.string().date(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: 'endDate must be greater than or equal to startDate',
    path: ['endDate'],
  })

export type DateRangeInput = z.infer<typeof dateRangeSchema>

// ================================================================
// Search (pagination + optional search keyword)
// ================================================================
export const searchSchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type SearchInput = z.infer<typeof searchSchema>
