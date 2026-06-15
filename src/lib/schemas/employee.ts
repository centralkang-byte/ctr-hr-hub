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
  titleId: z.string().uuid('Invalid title ID').optional().nullable(),
  positionId: z.string().uuid('Invalid position ID').optional().nullable(),
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
  contractType: z.enum(['FULL_TIME', 'CONTRACT', 'DISPATCH', 'INTERN']).optional(),
  hireDateFrom: z.string().date().optional(),
  hireDateTo: z.string().date().optional(),
})

export type EmployeeSearchInput = z.infer<typeof employeeSearchSchema>

// ================================================================
// Employee Export Schema (search filters + 선택 행 ids)
// 목록 API 계약은 건드리지 않고, export 라우트에서만 ids 허용.
// ids: 콤마구분 UUID 목록 (선택 내보내기). 회사 스코프와 AND 결합됨.
// ================================================================
export const employeeExportSchema = employeeSearchSchema.extend({
  ids: z
    .string()
    .optional()
    .transform((v) =>
      v
        ? v
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 500)
        : undefined,
    ),
})

export type EmployeeExportInput = z.infer<typeof employeeExportSchema>
