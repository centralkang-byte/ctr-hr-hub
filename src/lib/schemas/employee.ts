import { z } from 'zod'
import { searchSchema } from './common'

// ================================================================
// Employee Create Schema
// ================================================================
// Field names match Prisma Employee model exactly (camelCase)
export const employeeCreateSchema = z.object({
  // Required fields
  employeeNo: z.string().min(1, 'Employee number is required').max(50),
  name: z.string().min(1, 'Name (Korean) is required').max(100),
  email: z.string().email('Invalid email format'),
  companyId: z.string().uuid('Invalid company ID'),
  departmentId: z.string().uuid('Invalid department ID'),
  jobGradeId: z.string().uuid('Invalid job grade ID'),
  jobCategoryId: z.string().uuid('Invalid job category ID'),
  hireDate: z.string().date(),
  employmentType: z.enum(['FULL_TIME', 'CONTRACT', 'DISPATCH', 'INTERN']),
  status: z.enum(['ACTIVE', 'ON_LEAVE', 'RESIGNED', 'TERMINATED']),

  // Optional fields
  nameEn: z.string().max(100).optional(),
  managerId: z.string().uuid().optional().nullable(),
  birthDate: z.string().date().optional().nullable(),
  gender: z.string().max(20).optional().nullable(),
  nationality: z.string().max(50).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  emergencyContact: z.string().max(100).optional().nullable(),
  emergencyContactPhone: z.string().max(30).optional().nullable(),
  resignDate: z.string().date().optional().nullable(),
  photoUrl: z.string().url().optional().nullable(),
  locale: z.string().max(10).optional().nullable(),
  timezone: z.string().max(50).optional().nullable(),
})

export type EmployeeCreateInput = z.infer<typeof employeeCreateSchema>

// ================================================================
// Employee Update Schema (all fields optional)
// ================================================================
export const employeeUpdateSchema = employeeCreateSchema.partial()

export type EmployeeUpdateInput = z.infer<typeof employeeUpdateSchema>

// ================================================================
// Employee Search Schema (extends searchSchema with filters)
// ================================================================
export const employeeSearchSchema = searchSchema.extend({
  companyId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  jobGradeId: z.string().uuid().optional(),
  jobCategoryId: z.string().uuid().optional(),
  status: z.enum(['ACTIVE', 'ON_LEAVE', 'RESIGNED', 'TERMINATED']).optional(),
  employmentType: z.enum(['FULL_TIME', 'CONTRACT', 'DISPATCH', 'INTERN']).optional(),
})

export type EmployeeSearchInput = z.infer<typeof employeeSearchSchema>
