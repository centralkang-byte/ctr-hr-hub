// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Active EmployeeRole resolver (Session 207)
// src/lib/employee/active-roles.ts
//
// SessionUser.role은 단일 string pin (auth.ts:loadEmployeePermissions가
// `EmployeeRole.findFirst({ orderBy: startDate desc })`로 한 row만 선택).
// 멀티롤 employee (예: MANAGER + HR_ADMIN 동시 보유)는 보조 role의 권한이
// 세션에서 누락된다. 결재 라우트는 list/validator 양쪽에서 누락 → 결재 stuck.
//
// 본 헬퍼는 EmployeeRole 테이블에서 active rows(endDate=null)를 직접 조회해
// 사용자가 보유한 모든 role.code를 반환. 결재 라우트가 단일 SessionUser.role
// 대신 effective role set(`activeRoleCodes ∪ { user.role }`)을 사용해 멀티롤
// 결재 누락을 차단한다.
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'

/**
 * 직원이 특정 법인에서 현재 보유한 모든 active role code를 반환.
 *
 * - Active 정의: `EmployeeRole.endDate IS NULL` (CLAUDE.md "Active records" convention).
 * - companyId scope: cross-tenant guard. 사용자가 company-A에서 HR_ADMIN, company-B에서
 *   EMPLOYEE인 경우 company-A 호출은 HR_ADMIN만 반환. 기본 cross-tenant 차단은 caller의
 *   별도 검증(`user.companyId !== requisition.companyId`)으로 처리되지만, 헬퍼 자체에서도
 *   defense-in-depth로 scope 강제.
 *
 * @returns 사용자가 보유한 active role code 집합 (예: `Set { 'HR_ADMIN', 'MANAGER' }`)
 */
export async function getActiveRoleCodes(
  employeeId: string,
  companyId: string,
): Promise<Set<string>> {
  const rows = await prisma.employeeRole.findMany({
    where: { employeeId, companyId, endDate: null },
    select: { role: { select: { code: true } } },
  })
  return new Set(rows.map((r) => r.role.code))
}

/**
 * Effective role set = active EmployeeRoles ∪ session.user.role.
 *
 * Session role을 union에 포함하는 이유 (Codex Gate 1 MED):
 *   - SUPER_ADMIN bypass와 stale-session 일관성. EmployeeRole 테이블에 SUPER_ADMIN
 *     row가 있으면 helper가 자연 포함하지만, JWT/session 캐시가 더 fresh한 경우도
 *     보존. 양방향 union으로 false-deny와 false-allow 모두 차단.
 *   - 다만 cross-company 상황: SessionUser.role은 primary assignment 기준 단일 pin
 *     이므로 session.role을 union해도 cross-company 권한 확장은 일어나지 않음
 *     (session.companyId == requisition.companyId 가드가 caller에서 선행).
 */
export function buildEffectiveRoleCodes(
  activeRoleCodes: Set<string>,
  sessionRole: string,
): Set<string> {
  const set = new Set(activeRoleCodes)
  set.add(sessionRole)
  return set
}

/**
 * Requisition 결재 단계의 approverRole 분기 → 사용자가 결재 가능한 step role 매핑.
 *
 * SSOT for "어떤 effective role이 어떤 requisition step을 결재 가능한가" — list filter
 * (route.ts myApprovals)와 validator (validate-requisition-approver.ts) 양쪽에서
 * 동일 매핑을 사용해 drift를 차단 (Codex Gate 1 MED 2).
 *
 * - hr_admin step: HR_ADMIN 또는 SUPER_ADMIN
 * - ceo step: EXECUTIVE 또는 SUPER_ADMIN
 * - direct_manager / dept_head: 본 매퍼 무관 (position/department 기반)
 *
 * SUPER_ADMIN bypass — caller 책임:
 *   본 매퍼는 hr_admin/ceo 두 step만 다룬다. SUPER_ADMIN session.role(JWT pin) bypass는
 *   caller가 별도로 처리해야 한다. validator는 함수 진입 시 short-circuit; myApprovals
 *   list filter는 SUPER_ADMIN session에서 모든 step의 requisition 노출을 별도 분기로
 *   처리(현재 list는 hr_admin/ceo만 surfacing — direct_manager/dept_head는 실제 관계
 *   기반이라 SUPER_ADMIN도 동일 검증 통과). 이는 stale-session SUPER_ADMIN의 list 측
 *   가시성 한계로 의도된 trade-off (Codex Gate 2 R2 P2).
 *
 * @returns 사용자가 결재할 수 있는 approverRole 코드 배열 (e.g., ['hr_admin', 'ceo'])
 */
export function getEligibleApproverRolesForRequisition(
  effectiveRoleCodes: Set<string>,
): string[] {
  const eligible: string[] = []
  if (effectiveRoleCodes.has('HR_ADMIN') || effectiveRoleCodes.has('SUPER_ADMIN')) {
    eligible.push('hr_admin')
  }
  if (effectiveRoleCodes.has('EXECUTIVE') || effectiveRoleCodes.has('SUPER_ADMIN')) {
    eligible.push('ceo')
  }
  return eligible
}
