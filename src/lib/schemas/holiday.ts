import { z } from 'zod'
import { paginationSchema } from './common'

// ================================================================
// Holiday CRUD
// ================================================================
export const holidayCreateSchema = z.object({
  name: z.string().min(1, '공휴일명은 필수입니다').max(100),
  date: z.string().date(),
  isSubstitute: z.boolean().default(false),
  year: z.number().int().min(2020).max(2100),
})

export type HolidayCreateInput = z.infer<typeof holidayCreateSchema>

export const holidayUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  date: z.string().date().optional(),
  isSubstitute: z.boolean().optional(),
})

export type HolidayUpdateInput = z.infer<typeof holidayUpdateSchema>

// ================================================================
// Holiday Bulk Create (연도별 일괄 등록)
// ================================================================
export const holidayBulkCreateSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  holidays: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        date: z.string().date(),
        isSubstitute: z.boolean().default(false),
      }),
    )
    .min(1, '최소 1개의 공휴일을 입력하세요'),
})

export type HolidayBulkCreateInput = z.infer<typeof holidayBulkCreateSchema>

// ================================================================
// Holiday Search
// ================================================================
export const holidaySearchSchema = paginationSchema.extend({
  year: z.coerce.number().int().min(2020).max(2100).optional(),
})

export type HolidaySearchInput = z.infer<typeof holidaySearchSchema>
