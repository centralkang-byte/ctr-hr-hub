// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Settings Zod Schemas
// 관리자 설정 모듈 전체 스키마
// ═══════════════════════════════════════════════════════════

import { z } from 'zod'
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '@/lib/constants'

// ─── Company Settings ───────────────────────────────────

export const companySettingsUpdateSchema = z.object({
  coreValues: z.array(z.object({
    key: z.string().min(1),
    label: z.string().min(1),
    icon: z.string().optional(),
    color: z.string().optional(),
  })).optional(),
  fiscalYearStartMonth: z.number().int().min(1).max(12).optional(),
  probationMonths: z.number().int().min(0).max(24).optional(),
  maxOvertimeWeeklyHours: z.number().min(0).max(168).optional(),
  timezone: z.string().min(1).optional(),
  defaultLocale: z.string().min(2).max(5).optional(),
})

// ─── Branding ───────────────────────────────────────────

export const brandingUpdateSchema = z.object({
  logoUrl: z.string().url().nullable().optional(),
  faviconUrl: z.string().url().nullable().optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
})

export const presignedUploadSchema = z.object({
  entityType: z.string().min(1),
  filename: z.string().min(1),
  contentType: z.string().min(1),
})

// ─── Term Override ──────────────────────────────────────

export const termOverrideSearchSchema = z.object({
  page: z.coerce.number().int().positive().default(DEFAULT_PAGE),
  limit: z.coerce.number().int().positive().max(100).default(DEFAULT_PAGE_SIZE),
})

export const termOverrideUpsertSchema = z.object({
  termKey: z.string().min(1),
  labelKo: z.string().min(1),
  labelEn: z.string().optional(),
  labelLocal: z.string().optional(),
})

// ─── Enum Option ────────────────────────────────────────

export const enumOptionSearchSchema = z.object({
  page: z.coerce.number().int().positive().default(DEFAULT_PAGE),
  limit: z.coerce.number().int().positive().max(100).default(DEFAULT_PAGE_SIZE),
  enumGroup: z.string().optional(),
})

export const enumOptionCreateSchema = z.object({
  enumGroup: z.string().min(1),
  optionKey: z.string().min(1),
  label: z.string().min(1),
  color: z.string().optional(),
  icon: z.string().optional(),
  sortOrder: z.number().int().default(0),
})

export const enumOptionUpdateSchema = z.object({
  label: z.string().min(1).optional(),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
})

// ─── Custom Field ───────────────────────────────────────

export const customFieldSearchSchema = z.object({
  page: z.coerce.number().int().positive().default(DEFAULT_PAGE),
  limit: z.coerce.number().int().positive().max(100).default(DEFAULT_PAGE_SIZE),
  entityType: z.string().optional(),
})

export const customFieldCreateSchema = z.object({
  entityType: z.string().min(1),
  fieldKey: z.string().min(1),
  fieldLabel: z.string().min(1),
  fieldType: z.enum(['TEXT', 'NUMBER', 'DATE', 'SELECT', 'MULTI_SELECT', 'BOOLEAN', 'FILE']),
  options: z.any().optional(),
  isRequired: z.boolean().default(false),
  isSearchable: z.boolean().default(false),
  isVisibleToEmployee: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  sectionLabel: z.string().optional(),
})

export const customFieldUpdateSchema = z.object({
  fieldLabel: z.string().min(1).optional(),
  fieldType: z.enum(['TEXT', 'NUMBER', 'DATE', 'SELECT', 'MULTI_SELECT', 'BOOLEAN', 'FILE']).optional(),
  options: z.any().optional(),
  isRequired: z.boolean().optional(),
  isSearchable: z.boolean().optional(),
  isVisibleToEmployee: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  sectionLabel: z.string().optional(),
})

// ─── Workflow Rule ──────────────────────────────────────

export const workflowStepSchema = z.object({
  stepOrder: z.number().int().positive(),
  approverType: z.enum(['DIRECT_MANAGER', 'DEPARTMENT_HEAD', 'HR_ADMIN', 'SPECIFIC_ROLE', 'SPECIFIC_EMPLOYEE']),
  approverRoleId: z.string().uuid().nullable().optional(),
  approverEmployeeId: z.string().uuid().nullable().optional(),
  autoApproveAfterHours: z.number().int().positive().nullable().optional(),
  canSkip: z.boolean().default(false),
})

export const workflowRuleSearchSchema = z.object({
  page: z.coerce.number().int().positive().default(DEFAULT_PAGE),
  limit: z.coerce.number().int().positive().max(100).default(DEFAULT_PAGE_SIZE),
  workflowType: z.string().optional(),
})

export const workflowRuleCreateSchema = z.object({
  workflowType: z.string().min(1),
  name: z.string().min(1),
  steps: z.array(workflowStepSchema).min(1),
  conditions: z.any().optional(),
})

export const workflowRuleUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  conditions: z.any().optional(),
  steps: z.array(workflowStepSchema).optional(),
})

// ─── Email Template ─────────────────────────────────────

export const emailTemplateSearchSchema = z.object({
  page: z.coerce.number().int().positive().default(DEFAULT_PAGE),
  limit: z.coerce.number().int().positive().max(100).default(DEFAULT_PAGE_SIZE),
  eventType: z.string().optional(),
  channel: z.enum(['EMAIL', 'PUSH', 'IN_APP']).optional(),
})

export const emailTemplateCreateSchema = z.object({
  eventType: z.string().min(1),
  channel: z.enum(['EMAIL', 'PUSH', 'IN_APP']),
  locale: z.string().min(2).max(5).default('ko'),
  subject: z.string().min(1),
  body: z.string().min(1),
  variables: z.any().default([]),
  isActive: z.boolean().default(true),
})

export const emailTemplateUpdateSchema = z.object({
  subject: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  variables: z.any().optional(),
  isActive: z.boolean().optional(),
})

// ─── Evaluation Scale ───────────────────────────────────

export const evaluationScaleUpdateSchema = z.object({
  ratingScaleMin: z.number().int().min(1).max(10),
  ratingScaleMax: z.number().int().min(1).max(10),
  ratingLabels: z.array(z.string().min(1)),
  gradeLabels: z.record(z.string(), z.string()),
}).refine((d) => d.ratingScaleMin < d.ratingScaleMax, {
  message: '최소값은 최대값보다 작아야 합니다.',
  path: ['ratingScaleMin'],
}).refine((d) => d.ratingLabels.length === (d.ratingScaleMax - d.ratingScaleMin + 1), {
  message: '등급 라벨 수는 스케일 범위와 일치해야 합니다.',
  path: ['ratingLabels'],
})

// ─── Module Toggle ──────────────────────────────────────

export const moduleToggleSchema = z.object({
  enabledModules: z.array(z.string().min(1)),
})

// ─── Export Template ────────────────────────────────────

export const exportTemplateSearchSchema = z.object({
  page: z.coerce.number().int().positive().default(DEFAULT_PAGE),
  limit: z.coerce.number().int().positive().max(100).default(DEFAULT_PAGE_SIZE),
  entityType: z.string().optional(),
})

export const exportTemplateCreateSchema = z.object({
  entityType: z.string().min(1),
  name: z.string().min(1),
  columns: z.array(z.object({
    key: z.string().min(1),
    label: z.string().min(1),
    width: z.number().optional(),
  })).min(1),
  fileFormat: z.enum(['XLSX', 'CSV']).default('XLSX'),
  isDefault: z.boolean().default(false),
})

export const exportTemplateUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  columns: z.array(z.object({
    key: z.string().min(1),
    label: z.string().min(1),
    width: z.number().optional(),
  })).min(1).optional(),
  fileFormat: z.enum(['XLSX', 'CSV']).optional(),
  isDefault: z.boolean().optional(),
})

// ─── Dashboard Layout ───────────────────────────────────

export const dashboardLayoutUpdateSchema = z.object({
  dashboardLayout: z.any(),
})
