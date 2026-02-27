import { z } from 'zod'
import { searchSchema } from './common'

// ================================================================
// Department Create Schema
// ================================================================
// Field names match Prisma Department model exactly (camelCase)
export const departmentCreateSchema = z.object({
  // Required fields
  companyId: z.string().uuid('Invalid company ID'),
  code: z.string().min(1, 'Department code is required').max(20),
  name: z.string().min(1, 'Department name is required').max(100),
  level: z.number().int().min(0),

  // Optional fields
  parentId: z.string().uuid().optional().nullable(),
  nameEn: z.string().max(100).optional(),
  sortOrder: z.number().int().min(0).optional().default(0),
})

export type DepartmentCreateInput = z.infer<typeof departmentCreateSchema>

// ================================================================
// Department Update Schema (all fields optional, companyId excluded)
// ================================================================
export const departmentUpdateSchema = departmentCreateSchema
  .omit({ companyId: true })
  .partial()
  .refine(
    (data) => Object.keys(data).length > 0,
    { message: 'At least one field must be provided for update' }
  )

export type DepartmentUpdateInput = z.infer<typeof departmentUpdateSchema>

// ================================================================
// Department Search Schema (extends searchSchema with filters)
// ================================================================
export const departmentSearchSchema = searchSchema.extend({
  companyId: z.string().uuid().optional(),
  parentId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
})

export type DepartmentSearchInput = z.infer<typeof departmentSearchSchema>

// ================================================================
// Restructure Operation Schema
// ================================================================
export const restructureSchema = z.object({
  // Required fields
  companyId: z.string().uuid('Invalid company ID'),
  changeType: z.enum(['CREATE', 'MERGE', 'SPLIT', 'RENAME', 'CLOSE', 'RESTRUCTURE']),
  effectiveDate: z.string().date(),

  // Optional fields
  affectedDepartmentId: z.string().uuid().optional().nullable(),
  fromData: z.record(z.string(), z.unknown()).optional(),
  toData: z.record(z.string(), z.unknown()).optional(),
  reason: z.string().max(500).optional(),
  approvedBy: z.string().uuid().optional().nullable(),
  documentKey: z.string().max(500).optional().nullable(),
})

export type RestructureInput = z.infer<typeof restructureSchema>
