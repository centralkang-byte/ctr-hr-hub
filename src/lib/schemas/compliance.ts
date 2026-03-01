// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Compliance Zod Schemas
// ═══════════════════════════════════════════════════════════

import { z } from 'zod'
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '@/lib/constants'

// ─── Common Pagination ────────────────────────────────────

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(DEFAULT_PAGE),
  limit: z.coerce.number().int().positive().max(100).default(DEFAULT_PAGE_SIZE),
})

// ═══════════════════════════════════════════════════════════
// Russia (CTR-RU)
// ═══════════════════════════════════════════════════════════

export const militarySearchSchema = paginationSchema.extend({
  category: z.enum(['OFFICER', 'SOLDIER', 'RESERVIST', 'EXEMPT']).optional(),
  search: z.string().optional(),
})

export const militaryCreateSchema = z.object({
  employeeId: z.string().uuid(),
  category: z.enum(['OFFICER', 'SOLDIER', 'RESERVIST', 'EXEMPT']),
  rank: z.string().max(100).optional(),
  specialtyCode: z.string().max(50).optional(),
  fitnessCategory: z.enum(['FIT_A', 'FIT_B', 'FIT_C', 'FIT_D', 'UNFIT']),
  militaryOffice: z.string().max(200).optional(),
  registrationDate: z.string().datetime().optional(),
  deregistrationDate: z.string().datetime().nullable().optional(),
  notes: z.string().max(1000).optional(),
})

export const militaryUpdateSchema = militaryCreateSchema.partial().omit({ employeeId: true })

export const kedoSearchSchema = paginationSchema.extend({
  status: z.enum(['DRAFT', 'PENDING_SIGNATURE', 'SIGNED', 'REJECTED', 'EXPIRED']).optional(),
  documentType: z.enum([
    'EMPLOYMENT_CONTRACT', 'SUPPLEMENTARY_AGREEMENT', 'TRANSFER_ORDER',
    'VACATION_ORDER', 'DISMISSAL_ORDER', 'SALARY_CHANGE', 'DISCIPLINARY_ORDER',
  ]).optional(),
  employeeId: z.string().uuid().optional(),
})

export const kedoCreateSchema = z.object({
  employeeId: z.string().uuid(),
  documentType: z.enum([
    'EMPLOYMENT_CONTRACT', 'SUPPLEMENTARY_AGREEMENT', 'TRANSFER_ORDER',
    'VACATION_ORDER', 'DISMISSAL_ORDER', 'SALARY_CHANGE', 'DISCIPLINARY_ORDER',
  ]),
  title: z.string().min(1).max(300),
  content: z.string().optional(),
  signatureLevel: z.enum(['PEP', 'UNEP', 'UKEP']).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
})

export const kedoUpdateSchema = kedoCreateSchema.partial().omit({ employeeId: true })

export const kedoSignSchema = z.object({
  signatureLevel: z.enum(['PEP', 'UNEP', 'UKEP']),
})

export const kedoRejectSchema = z.object({
  rejectionReason: z.string().min(1).max(1000),
})

export const ruReportQuerySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  quarter: z.coerce.number().int().min(1).max(4).optional(),
})

// ═══════════════════════════════════════════════════════════
// China (CTR-CN)
// ═══════════════════════════════════════════════════════════

export const socialInsuranceConfigSearchSchema = paginationSchema.extend({
  insuranceType: z.enum([
    'PENSION', 'MEDICAL', 'UNEMPLOYMENT', 'WORK_INJURY', 'MATERNITY_INS', 'HOUSING_FUND',
  ]).optional(),
  city: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
})

export const socialInsuranceConfigCreateSchema = z.object({
  insuranceType: z.enum([
    'PENSION', 'MEDICAL', 'UNEMPLOYMENT', 'WORK_INJURY', 'MATERNITY_INS', 'HOUSING_FUND',
  ]),
  city: z.string().min(1).max(100),
  employerRate: z.number().min(0).max(100),
  employeeRate: z.number().min(0).max(100),
  baseMin: z.number().min(0),
  baseMax: z.number().min(0),
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().nullable().optional(),
})

export const socialInsuranceConfigUpdateSchema = socialInsuranceConfigCreateSchema.partial()

export const socialInsuranceRecordSearchSchema = paginationSchema.extend({
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  employeeId: z.string().uuid().optional(),
  insuranceType: z.enum([
    'PENSION', 'MEDICAL', 'UNEMPLOYMENT', 'WORK_INJURY', 'MATERNITY_INS', 'HOUSING_FUND',
  ]).optional(),
})

export const socialInsuranceCalculateSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
})

export const socialInsuranceExportSchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
})

// ═══════════════════════════════════════════════════════════
// GDPR / Privacy
// ═══════════════════════════════════════════════════════════

export const gdprConsentSearchSchema = paginationSchema.extend({
  employeeId: z.string().uuid().optional(),
  purpose: z.enum([
    'EMPLOYMENT_PROCESSING', 'PAYROLL_PROCESSING', 'BENEFITS_ADMINISTRATION',
    'PERFORMANCE_MANAGEMENT', 'TRAINING_RECORDS', 'HEALTH_SAFETY',
    'MARKETING_COMMUNICATION', 'THIRD_PARTY_TRANSFER',
  ]).optional(),
  status: z.enum(['ACTIVE', 'REVOKED', 'EXPIRED']).optional(),
})

export const gdprConsentCreateSchema = z.object({
  employeeId: z.string().uuid(),
  purpose: z.enum([
    'EMPLOYMENT_PROCESSING', 'PAYROLL_PROCESSING', 'BENEFITS_ADMINISTRATION',
    'PERFORMANCE_MANAGEMENT', 'TRAINING_RECORDS', 'HEALTH_SAFETY',
    'MARKETING_COMMUNICATION', 'THIRD_PARTY_TRANSFER',
  ]),
  legalBasis: z.string().max(500).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
})

export const gdprRequestSearchSchema = paginationSchema.extend({
  employeeId: z.string().uuid().optional(),
  requestType: z.enum([
    'ACCESS', 'RECTIFICATION', 'ERASURE', 'PORTABILITY', 'RESTRICTION', 'OBJECTION',
  ]).optional(),
  status: z.enum(['GDPR_PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'EXPIRED']).optional(),
})

export const gdprRequestCreateSchema = z.object({
  employeeId: z.string().uuid(),
  requestType: z.enum([
    'ACCESS', 'RECTIFICATION', 'ERASURE', 'PORTABILITY', 'RESTRICTION', 'OBJECTION',
  ]),
  description: z.string().max(2000).optional(),
})

export const gdprRequestUpdateSchema = z.object({
  status: z.enum(['GDPR_PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'EXPIRED']),
  responseNote: z.string().max(2000).optional(),
})

export const retentionPolicySearchSchema = paginationSchema.extend({
  category: z.enum([
    'EMPLOYMENT_RECORDS', 'PAYROLL_DATA', 'PERFORMANCE_DATA', 'TRAINING_RECORDS',
    'RECRUITMENT_DATA', 'HEALTH_SAFETY', 'DISCIPLINARY_RECORDS', 'LEAVE_RECORDS', 'AUDIT_LOGS',
  ]).optional(),
  isActive: z.coerce.boolean().optional(),
})

export const retentionPolicyCreateSchema = z.object({
  category: z.enum([
    'EMPLOYMENT_RECORDS', 'PAYROLL_DATA', 'PERFORMANCE_DATA', 'TRAINING_RECORDS',
    'RECRUITMENT_DATA', 'HEALTH_SAFETY', 'DISCIPLINARY_RECORDS', 'LEAVE_RECORDS', 'AUDIT_LOGS',
  ]),
  retentionMonths: z.number().int().min(1).max(600),
  description: z.string().max(1000).optional(),
  autoDelete: z.boolean().default(false),
  anonymize: z.boolean().default(true),
})

export const retentionPolicyUpdateSchema = retentionPolicyCreateSchema.partial()

export const dpiaSearchSchema = paginationSchema.extend({
  status: z.enum(['DPIA_DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED']).optional(),
})

export const dpiaCreateSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  processingScope: z.string().max(2000).optional(),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  mitigations: z.string().max(5000).optional(),
})

export const dpiaUpdateSchema = dpiaCreateSchema.partial().extend({
  status: z.enum(['DPIA_DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED']).optional(),
})

export const piiAccessSearchSchema = paginationSchema.extend({
  actorId: z.string().uuid().optional(),
  targetId: z.string().uuid().optional(),
  accessType: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
})

// ═══════════════════════════════════════════════════════════
// Korea (CTR-KR)
// ═══════════════════════════════════════════════════════════

export const workHoursQuerySchema = z.object({
  weekStart: z.string().optional(),
})

export const workHoursEmployeesSchema = paginationSchema.extend({
  weekStart: z.string().optional(),
  status: z.enum(['COMPLIANT', 'WARNING', 'VIOLATION']).optional(),
  search: z.string().optional(),
})

export const mandatoryTrainingSearchSchema = paginationSchema.extend({
  year: z.coerce.number().int().min(2020).max(2100).optional(),
  trainingType: z.enum([
    'SEXUAL_HARASSMENT_PREVENTION', 'WORKPLACE_HARASSMENT',
    'DISABILITY_AWARENESS', 'OCCUPATIONAL_SAFETY', 'PERSONAL_INFO_PROTECTION',
  ]).optional(),
})

export const mandatoryTrainingCreateSchema = z.object({
  courseId: z.string().uuid(),
  trainingType: z.enum([
    'SEXUAL_HARASSMENT_PREVENTION', 'WORKPLACE_HARASSMENT',
    'DISABILITY_AWARENESS', 'OCCUPATIONAL_SAFETY', 'PERSONAL_INFO_PROTECTION',
  ]),
  year: z.number().int().min(2020).max(2100),
  dueDate: z.string().datetime(),
  requiredHours: z.number().positive(),
})

export const mandatoryTrainingUpdateSchema = mandatoryTrainingCreateSchema.partial()

export const mandatoryTrainingStatusSchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
})

export const severanceInterimSearchSchema = paginationSchema.extend({
  status: z.enum(['SIP_PENDING', 'SIP_APPROVED', 'SIP_REJECTED', 'SIP_PAID']).optional(),
  employeeId: z.string().uuid().optional(),
})

export const severanceInterimCreateSchema = z.object({
  employeeId: z.string().uuid(),
  reason: z.enum([
    'HOUSING_PURCHASE', 'HOUSING_LEASE', 'MEDICAL_EXPENSE',
    'BANKRUPTCY', 'NATURAL_DISASTER', 'OTHER_APPROVED',
  ]),
  requestDate: z.string().datetime(),
  attachmentUrl: z.string().url().optional(),
})

export const severanceInterimUpdateSchema = z.object({
  status: z.enum(['SIP_PENDING', 'SIP_APPROVED', 'SIP_REJECTED', 'SIP_PAID']),
  rejectionReason: z.string().max(1000).optional(),
})

export const severanceCalculateSchema = z.object({
  employeeId: z.string().uuid(),
})
