// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Sensitive Data Masking Utilities
// ═══════════════════════════════════════════════════════════

import { ROLE } from '@/lib/constants'

// ─── Masking Functions ───────────────────────────────────

/** 주민번호: 900101-******* */
export function maskResidentId(value: string): string {
  if (!value || value.length < 6) return '***-*******'
  return `${value.substring(0, 6)}-*******`
}

/** 은행 계좌: ***-**-123456 */
export function maskBankAccount(value: string): string {
  if (!value || value.length < 6) return '***-**-******'
  const last6 = value.replace(/[^0-9]/g, '').slice(-6)
  return `***-**-${last6}`
}

/** 이메일: san***@company.com */
export function maskEmail(value: string): string {
  if (!value) return '***@***'
  const [local, domain] = value.split('@')
  if (!local || !domain) return '***@***'
  const visible = local.substring(0, Math.min(3, local.length))
  return `${visible}***@${domain}`
}

/** 전화번호: 010-****-5678 */
export function maskPhone(value: string): string {
  if (!value) return '***-****-****'
  const digits = value.replace(/[^0-9]/g, '')
  if (digits.length < 4) return '***-****-****'
  const last4 = digits.slice(-4)
  if (digits.length <= 8) return `****-${last4}`
  const first3 = digits.slice(0, 3)
  return `${first3}-****-${last4}`
}

/** 급여/연봉: 역할별 노출 제어 */
export function maskSalary(
  value: number | string | null,
  userRole: string,
  isOwnData: boolean,
): number | string | null {
  if (value === null || value === undefined) return null
  // SUPER_ADMIN, HR_ADMIN always see salary
  if (userRole === ROLE.SUPER_ADMIN || userRole === ROLE.HR_ADMIN) return value
  // MANAGER can see team salary
  if (userRole === ROLE.MANAGER) return value
  // EMPLOYEE can only see own salary
  if (isOwnData) return value
  return '***'
}

// ─── Field Detection ─────────────────────────────────────

const SENSITIVE_FIELD_PATTERNS: Record<string, (value: string) => string> = {
  residentId: maskResidentId,
  ssn: maskResidentId,
  socialSecurityNumber: maskResidentId,
  bankAccount: maskBankAccount,
  accountNumber: maskBankAccount,
  bankAccountNumber: maskBankAccount,
  personalEmail: maskEmail,
  phone: maskPhone,
  mobile: maskPhone,
  mobilePhone: maskPhone,
  personalPhone: maskPhone,
  emergencyContact: maskPhone,
}

const SALARY_FIELDS = new Set([
  'baseSalary',
  'newBaseSalary',
  'oldBaseSalary',
  'totalCompensation',
  'annualSalary',
  'monthlySalary',
  'grossPay',
  'netPay',
  'totalGross',
  'totalNet',
  'totalDeductions',
  'totalAllowances',
])

// ─── Auto-mask Sensitive Fields ──────────────────────────

export function maskSensitiveFields<T>(
  data: T,
  userRole: string,
  currentUserId?: string,
): T {
  if (data === null || data === undefined) return data
  if (Array.isArray(data)) {
    return data.map((item) =>
      maskSensitiveFields(item, userRole, currentUserId),
    ) as T
  }
  if (typeof data !== 'object') return data

  const result = { ...(data as Record<string, unknown>) }

  // Determine if this is the user's own data
  const isOwnData =
    currentUserId !== undefined &&
    (result.id === currentUserId || result.employeeId === currentUserId)

  for (const [key, value] of Object.entries(result)) {
    // Mask string fields
    if (typeof value === 'string' && SENSITIVE_FIELD_PATTERNS[key]) {
      result[key] = SENSITIVE_FIELD_PATTERNS[key](value)
    }

    // Mask salary fields based on role
    if (SALARY_FIELDS.has(key) && (typeof value === 'number' || typeof value === 'string')) {
      result[key] = maskSalary(
        value as number | string,
        userRole,
        isOwnData,
      )
    }

    // Recurse into nested objects (but not dates or special types)
    if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
      result[key] = maskSensitiveFields(value, userRole, currentUserId)
    }
  }

  return result as T
}
