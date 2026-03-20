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
  title: z.string().min(1).max(200).optional(),
  fileName: z.string().min(1).max(200).optional(),  // alias for title
  docType: z.enum([
    'EMPLOYMENT_RULES',
    'HR_POLICY',
    'BENEFIT_GUIDE',
    'SAFETY_MANUAL',
    'EMPLOYEE_HANDBOOK',
    'OTHER',
  ]).optional(),
  fileType: z.string().optional(),  // alias for docType
  contentText: z.string().min(1),
  version: z.string().max(20).default('1.0'),
  locale: z.string().max(10).default('ko'),
}).transform(({ fileName, fileType, ...rest }) => {
  const DOC_TYPE_VALUES = ['EMPLOYMENT_RULES', 'HR_POLICY', 'BENEFIT_GUIDE', 'SAFETY_MANUAL', 'EMPLOYEE_HANDBOOK', 'OTHER'] as const
  const resolvedTitle = rest.title || fileName
  const resolvedDocType = rest.docType || (DOC_TYPE_VALUES.includes(fileType as typeof DOC_TYPE_VALUES[number]) ? fileType as typeof DOC_TYPE_VALUES[number] : undefined)

  if (!resolvedTitle) throw new Error('title 또는 fileName은 필수입니다.')
  if (!resolvedDocType) throw new Error('docType 또는 fileType은 필수입니다.')

  return {
    ...rest,
    title: resolvedTitle,
    docType: resolvedDocType as typeof DOC_TYPE_VALUES[number],
  }
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
