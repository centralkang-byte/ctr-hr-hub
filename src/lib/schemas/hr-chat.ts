import { z } from 'zod'
import { paginationSchema } from './common'

export const sessionCreateSchema = z.object({
  title: z.string().max(200).optional(),
})

export const messageCreateSchema = z.object({
  content: z.string().min(1).max(2000),
})

export const messageFeedbackSchema = z.object({
  feedback: z.enum(['POSITIVE', 'NEGATIVE']),
})

export const documentUploadSchema = z.object({
  title: z.string().min(1).max(200),
  docType: z.enum([
    'EMPLOYMENT_RULES',
    'HR_POLICY',
    'BENEFIT_GUIDE',
    'SAFETY_MANUAL',
    'EMPLOYEE_HANDBOOK',
    'OTHER',
  ]),
  contentText: z.string().min(1),
  version: z.string().max(20).default('1.0'),
  locale: z.string().max(10).default('ko'),
})

export const documentUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  docType: z
    .enum([
      'EMPLOYMENT_RULES',
      'HR_POLICY',
      'BENEFIT_GUIDE',
      'SAFETY_MANUAL',
      'EMPLOYEE_HANDBOOK',
      'OTHER',
    ])
    .optional(),
  contentText: z.string().min(1).optional(),
  version: z.string().max(20).optional(),
  locale: z.string().max(10).optional(),
  isActive: z.boolean().optional(),
})

export const documentListSchema = paginationSchema.extend({
  docType: z
    .enum([
      'EMPLOYMENT_RULES',
      'HR_POLICY',
      'BENEFIT_GUIDE',
      'SAFETY_MANUAL',
      'EMPLOYEE_HANDBOOK',
      'OTHER',
    ])
    .optional(),
  search: z.string().optional(),
  isActive: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
})
