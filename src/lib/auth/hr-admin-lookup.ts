// ═══════════════════════════════════════════════════════════
// CTR HR Hub — HR Admin Lookup Utility
// src/lib/auth/hr-admin-lookup.ts
//
// FIX: Issue #1 — Shared, reliable HR_ADMIN lookup using RBAC
//      EmployeeRole table instead of ad-hoc Employee queries.
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// PROTECTED — DO NOT MODIFY without architecture review
// This file is a core infrastructure component. Changes here
// can break: HR admin resolution for multi-company queries
// Last verified: 2026-03-12 (Q-4 P6)
// ═══════════════════════════════════════════════════════════════

import type { PrismaTx } from '@/lib/prisma-rls'

/**
 * 회사의 HR_ADMIN 역할을 가진 활성 직원 ID 목록을 반환합니다.
 *
 * @param prisma  - PrismaClient 인스턴스 (또는 tx)
 * @param companyId - 대상 법인 ID
 * @returns       - HR_ADMIN 직원 ID 배열 (없으면 빈 배열)
 *
 * Usage:
 *   const hrAdminIds = await getHrAdminIds(prisma, companyId)
 */
export async function getHrAdminIds(
  prisma: PrismaTx,
  companyId: string,
): Promise<string[]> {
  // FIX: Issue #1 — Use EmployeeRole (RBAC) instead of fragile Employee-level queries.
  // endDate: null → 현재 유효한 역할만 대상
  const hrRoles = await prisma.employeeRole.findMany({
    where: {
      role: { code: 'HR_ADMIN' },
      companyId,
      endDate: null,
    },
    select: { employeeId: true },
  })

  return hrRoles.map((r) => r.employeeId)
}

/**
 * 회사의 SUPER_ADMIN + HR_ADMIN 합산 활성 직원 ID 목록.
 * 캘리브레이션 알림 등 더 넓은 대상이 필요할 때 사용.
 */
export async function getHrAndSuperAdminIds(
  prisma: PrismaTx,
  companyId: string,
): Promise<string[]> {
  const roles = await prisma.employeeRole.findMany({
    where: {
      role: { code: { in: ['HR_ADMIN', 'SUPER_ADMIN'] } },
      companyId,
      endDate: null,
    },
    select: { employeeId: true },
  })

  // 중복 제거 (한 사람이 두 역할 보유 가능)
  return [...new Set(roles.map((r) => r.employeeId))]
}
