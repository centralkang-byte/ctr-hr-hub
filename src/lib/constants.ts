// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Constants
// ═══════════════════════════════════════════════════════════

// ─── Module Codes ─────────────────────────────────────────

export const MODULE = {
  EMPLOYEES: 'employees',
  ORG: 'org',
  ATTENDANCE: 'attendance',
  LEAVE: 'leave',
  RECRUITMENT: 'recruitment',
  PERFORMANCE: 'performance',
  PAYROLL: 'payroll',
  COMPENSATION: 'compensation',
  OFFBOARDING: 'offboarding',
  DISCIPLINE: 'discipline',
  BENEFITS: 'benefits',
  ANALYTICS: 'analytics',
  ONBOARDING: 'onboarding',
  TRAINING: 'training',
  PULSE: 'pulse',
  SUCCESSION: 'succession',
  HR_CHATBOT: 'hr_chatbot',
  SETTINGS: 'settings',
} as const

export type ModuleCode = (typeof MODULE)[keyof typeof MODULE]

// ─── Action Codes ─────────────────────────────────────────

export const ACTION = {
  VIEW: 'read',
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  APPROVE: 'manage',
  EXPORT: 'export',
} as const

export type ActionCode = (typeof ACTION)[keyof typeof ACTION]

// ─── Role Codes ───────────────────────────────────────────

export const ROLE = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  HR_ADMIN: 'HR_ADMIN',
  MANAGER: 'MANAGER',
  EMPLOYEE: 'EMPLOYEE',
  EXECUTIVE: 'EXECUTIVE',
} as const

export type RoleCode = (typeof ROLE)[keyof typeof ROLE]

// ─── Enabled Modules (for tenant_settings) ────────────────

export const DEFAULT_ENABLED_MODULES = [
  'CORE_HR',
  'ATTENDANCE',
  'LEAVE',
  'PERFORMANCE',
] as const

export const ALL_MODULES = [
  ...DEFAULT_ENABLED_MODULES,
  'RECRUITMENT',
  'PAYROLL',
  'OFFBOARDING',
  'DISCIPLINE',
  'COMPENSATION',
  'BENEFITS',
  'PULSE',
  'PEER_REVIEW',
  'SUCCESSION',
  'L_AND_D',
  'HR_CHATBOT',
] as const

export type EnabledModule = (typeof ALL_MODULES)[number]

// ─── Pagination Defaults ──────────────────────────────────

export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100
export const DEFAULT_PAGE = 1

// ─── Date Formats ─────────────────────────────────────────

export const DATE_FORMAT = {
  DATE: 'yyyy-MM-dd',
  DATETIME: 'yyyy-MM-dd HH:mm:ss',
  DISPLAY_DATE: 'yyyy년 MM월 dd일',
  DISPLAY_DATETIME: 'yyyy년 MM월 dd일 HH:mm',
  DISPLAY_TIME: 'HH:mm',
  ISO: "yyyy-MM-dd'T'HH:mm:ss.SSSxxx",
} as const

// ─── Core Values (CTR default) ────────────────────────────

export const DEFAULT_CORE_VALUES = [
  { key: 'CHALLENGE', label: '도전', icon: 'rocket', color: '#E30613' },
  { key: 'TRUST', label: '신뢰', icon: 'shield', color: '#003087' },
  { key: 'RESPONSIBILITY', label: '책임', icon: 'target', color: '#00A651' },
  { key: 'RESPECT', label: '존중', icon: 'heart', color: '#F5A623' },
] as const

// ─── Rating Scale (default) ───────────────────────────────

export const DEFAULT_RATING_SCALE = {
  min: 1,
  max: 5,
  labels: ['매우 부족', '부족', '보통', '우수', '탁월'],
} as const

export const DEFAULT_GRADE_LABELS: Record<string, string> = {
  S: '최우수',
  A: '우수',
  B: '보통',
  C: '미흡',
  D: '부진',
}

// ─── Brand Colors (CTR default) ───────────────────────────

export const DEFAULT_BRAND_COLORS = {
  primary: '#003087',
  secondary: '#1B3A5C',
  accent: '#E30613',
} as const

// ─── Term Keys ────────────────────────────────────────────

export const TERM_KEYS = [
  'department',
  'job_grade',
  'employee_code',
  'manager',
  'team',
  'position',
  'recognition',
  'one_on_one',
  'goal',
  'evaluation',
  'leave',
  'onboarding',
  'offboarding',
  'discipline',
] as const

export type TermKey = (typeof TERM_KEYS)[number]

// ─── Workflow Types ───────────────────────────────────────

export const WORKFLOW_TYPES = [
  'LEAVE_APPROVAL',
  'PROFILE_CHANGE',
  'GOAL_APPROVAL',
  'PAYROLL_APPROVAL',
] as const

export type WorkflowType = (typeof WORKFLOW_TYPES)[number]

// ─── Redis TTL ────────────────────────────────────────────

export const CACHE_TTL = {
  TENANT_SETTINGS: 300,   // 5 min
  TERM_OVERRIDES: 300,    // 5 min
  ENUM_OPTIONS: 300,      // 5 min
  SESSION: 3600,          // 1 hour
  PERMISSIONS: 600,       // 10 min
} as const
