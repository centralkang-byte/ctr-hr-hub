// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Audit Logging (Fire-and-Forget)
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma/client'

// ─── Sensitivity Levels ──────────────────────────────────

export type SensitivityLevel = 'HIGH' | 'MEDIUM' | 'LOW'

const HIGH_SENSITIVITY_ACTIONS = new Set([
  'VIEW_SALARY',
  'VIEW_COMPENSATION',
  'VIEW_PAYROLL',
  'VIEW_BANK_ACCOUNT',
  'VIEW_RESIDENT_ID',
  'VIEW_SSN',
  'EXPORT_PAYROLL',
  'EXPORT_COMPENSATION',
  'compensation.view',
  'payroll.view',
  'payroll.export',
  'compensation.history.view',
  'compliance.gdpr.request.create',
  'compliance.gdpr.request.execute',
])

const MEDIUM_SENSITIVITY_ACTIONS = new Set([
  'VIEW_EMPLOYEE_DETAIL',
  'UPDATE_EMPLOYEE',
  'employee.view_detail',
  'employee.update',
  'leave.approve',
  'leave.reject',
  'performance.evaluate',
])

function detectSensitivity(
  action: string,
  resourceType: string,
  explicit?: SensitivityLevel,
): SensitivityLevel | null {
  if (explicit) return explicit
  if (HIGH_SENSITIVITY_ACTIONS.has(action)) return 'HIGH'
  if (MEDIUM_SENSITIVITY_ACTIONS.has(action)) return 'MEDIUM'
  if (['compensation', 'payroll', 'bankAccount', 'salary'].includes(resourceType)) return 'HIGH'
  return null
}

// ─── Input Type ──────────────────────────────────────────

export interface AuditLogInput {
  actorId: string
  action: string
  resourceType: string
  resourceId: string
  companyId: string
  changes?: Prisma.InputJsonValue
  ip?: string
  userAgent?: string
  sensitivityLevel?: SensitivityLevel
}

/**
 * 감사 로그를 비동기(fire-and-forget)로 기록합니다.
 * 로그 기록 실패가 비즈니스 로직에 영향을 주지 않습니다.
 */
export function logAudit(input: AuditLogInput): void {
  const sensitivity = detectSensitivity(
    input.action,
    input.resourceType,
    input.sensitivityLevel,
  )

  // Fire-and-forget: do not await
  prisma.auditLog
    .create({
      data: {
        actorId: input.actorId,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        companyId: input.companyId,
        changes: input.changes ?? undefined,
        ipAddress: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        sensitivityLevel: sensitivity,
      },
    })
    .catch(() => {
      // Silently fail: audit logging should not break business logic
    })
}

/**
 * 감사 로그를 동기적으로 기록합니다. (트랜잭션 내 사용)
 */
export async function logAuditSync(input: AuditLogInput): Promise<void> {
  const sensitivity = detectSensitivity(
    input.action,
    input.resourceType,
    input.sensitivityLevel,
  )

  await prisma.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      companyId: input.companyId,
      changes: input.changes ?? undefined,
      ipAddress: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      sensitivityLevel: sensitivity,
    },
  })
}

/**
 * Request에서 IP와 User-Agent 추출
 */
export function extractRequestMeta(headers: Headers): {
  ip: string
  userAgent: string
} {
  return {
    ip:
      headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      headers.get('x-real-ip') ??
      'unknown',
    userAgent: headers.get('user-agent') ?? 'unknown',
  }
}
