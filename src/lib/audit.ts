// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Audit Logging (Fire-and-Forget)
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma/client'

export interface AuditLogInput {
  actorId: string
  action: string
  resourceType: string
  resourceId: string
  companyId: string
  changes?: Prisma.InputJsonValue
  ip?: string
  userAgent?: string
}

/**
 * 감사 로그를 비동기(fire-and-forget)로 기록합니다.
 * 로그 기록 실패가 비즈니스 로직에 영향을 주지 않습니다.
 */
export function logAudit(input: AuditLogInput): void {
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
