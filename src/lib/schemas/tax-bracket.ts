import { z } from 'zod'

// ================================================================
// Tax Bracket CRUD
// ================================================================

export const taxBracketCreateSchema = z.object({
  countryCode: z.string().length(2),
  taxType: z.enum(['INCOME_TAX', 'LOCAL_TAX', 'SOCIAL_INSURANCE', 'PENSION', 'HEALTH_INSURANCE', 'OTHER']),
  name: z.string().min(1).max(100),
  bracketMin: z.number().min(0),
  bracketMax: z.number().optional().nullable(),
  rate: z.number().min(0).max(1),
  fixedAmount: z.number().default(0),
  effectiveFrom: z.string().date(),
  effectiveTo: z.string().date().optional().nullable(),
  description: z.string().max(500).optional().nullable(),
})

export type TaxBracketCreateInput = z.infer<typeof taxBracketCreateSchema>

export const taxBracketUpdateSchema = taxBracketCreateSchema
  .partial()
  .omit({ countryCode: true, taxType: true })

export type TaxBracketUpdateInput = z.infer<typeof taxBracketUpdateSchema>

// ================================================================
// Tax Bracket List / Search
// ================================================================

export const taxBracketListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  countryCode: z.string().length(2).optional(),
  taxType: z.enum(['INCOME_TAX', 'LOCAL_TAX', 'SOCIAL_INSURANCE', 'PENSION', 'HEALTH_INSURANCE', 'OTHER']).optional(),
  isActive: z.coerce.boolean().optional(),
})

export type TaxBracketListInput = z.infer<typeof taxBracketListSchema>

// ================================================================
// Tax Bracket Seed
// ================================================================

export const taxBracketSeedSchema = z.object({
  countryCode: z.string().length(2),
})

export type TaxBracketSeedInput = z.infer<typeof taxBracketSeedSchema>
