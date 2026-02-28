// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Training (L&D) Zod Schemas
// ═══════════════════════════════════════════════════════════

import { z } from 'zod'
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '@/lib/constants'

// ─── Training Course ────────────────────────────────────

export const courseSearchSchema = z.object({
  page: z.coerce.number().int().positive().default(DEFAULT_PAGE),
  limit: z.coerce.number().int().positive().max(100).default(DEFAULT_PAGE_SIZE),
  category: z.enum(['COMPLIANCE', 'TECHNICAL', 'LEADERSHIP', 'SAFETY_TRAINING', 'ONBOARDING_TRAINING', 'OTHER']).optional(),
  isMandatory: z.coerce.boolean().optional(),
  isActive: z.coerce.boolean().optional(),
})

export const courseCreateSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(2000).optional(),
  category: z.enum(['COMPLIANCE', 'TECHNICAL', 'LEADERSHIP', 'SAFETY_TRAINING', 'ONBOARDING_TRAINING', 'OTHER']),
  isMandatory: z.boolean().default(false),
  durationHours: z.number().positive().optional(),
  provider: z.string().max(200).optional(),
  externalUrl: z.string().url().optional(),
})

export const courseUpdateSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(2000).nullable().optional(),
  category: z.enum(['COMPLIANCE', 'TECHNICAL', 'LEADERSHIP', 'SAFETY_TRAINING', 'ONBOARDING_TRAINING', 'OTHER']).optional(),
  isMandatory: z.boolean().optional(),
  durationHours: z.number().positive().nullable().optional(),
  provider: z.string().max(200).nullable().optional(),
  externalUrl: z.string().url().nullable().optional(),
  isActive: z.boolean().optional(),
})

// ─── Training Enrollment ────────────────────────────────

export const trainingEnrollmentSearchSchema = z.object({
  page: z.coerce.number().int().positive().default(DEFAULT_PAGE),
  limit: z.coerce.number().int().positive().max(100).default(DEFAULT_PAGE_SIZE),
  courseId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
  status: z.enum(['ENROLLED', 'IN_PROGRESS', 'ENROLLMENT_COMPLETED', 'DROPPED']).optional(),
})

export const trainingEnrollmentCreateSchema = z.object({
  courseId: z.string().uuid(),
  employeeIds: z.array(z.string().uuid()).min(1).max(100),
})

export const trainingEnrollmentUpdateSchema = z.object({
  status: z.enum(['ENROLLED', 'IN_PROGRESS', 'ENROLLMENT_COMPLETED', 'DROPPED']),
  score: z.number().min(0).max(100).optional(),
  completedAt: z.string().datetime().optional(),
})
