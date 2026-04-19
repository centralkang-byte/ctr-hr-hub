// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Employee peers helper
// 같은 매니저(reportsToPositionId)를 공유하는 동료 수 조회.
// R3 (Session 178) — home summary EMPLOYEE 브랜치의 `myTeamSize` 필드 소스.
// Codex Gate 1 HIGH: getDirectReportIds().length fallback이 companyId/ACTIVE 필터 없어
//   overcount 위험 → 여기서 명시 필터로 계산한다.
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'

/**
 * 본인과 같은 `reportsToPositionId`를 공유하는 직원 수를 반환 (본인 제외).
 *
 * 정의:
 *   "같은 매니저 아래의 동료 수"
 *
 * 동작:
 * 1. 본인의 primary ACTIVE assignment를 찾는다.
 * 2. 해당 position의 `reportsToPositionId`를 꺼낸다.
 * 3. reportsToPositionId가 null이면 최상위(CEO 등) → 0 반환.
 *    "reportsTo가 null인 전체 직원 수"를 반환하지 않는다 (Codex HIGH 경고).
 * 4. 같은 reportsToPositionId를 가진 다른 직원의 primary ACTIVE assignment 수를
 *    `employeeAssignment.count`로 계산 (companyId + status='ACTIVE' + isPrimary + endDate null + 본인 제외).
 *
 * 매니저 본인이 호출한 경우:
 *   매니저도 그 자신의 상위 reportsTo가 있으면 그 수준의 동료(타 매니저)가 잡힌다.
 *   상위가 없으면 0.
 *
 * 캐시: home summary가 이미 `withCache(DASHBOARD_KPI, 'user')` 60s로 감싸므로 여기서는 추가 캐싱 안 함.
 */
export async function getPeerCount(args: {
  employeeId: string
  companyId: string
}): Promise<number> {
  const { employeeId, companyId } = args

  // 1. 본인의 primary ACTIVE assignment + position
  const myAssignment = await prisma.employeeAssignment.findFirst({
    where: {
      employeeId,
      companyId,
      isPrimary: true,
      status: 'ACTIVE',
      endDate: null,
    },
    select: {
      position: { select: { reportsToPositionId: true } },
    },
  })

  const reportsToPositionId = myAssignment?.position?.reportsToPositionId
  if (!reportsToPositionId) {
    // 최상위이거나 position/assignment 없음 → 동료 0
    return 0
  }

  // 2. 같은 reportsToPositionId를 공유하는 다른 직원 (primary ACTIVE)
  const peers = await prisma.employeeAssignment.count({
    where: {
      companyId,
      isPrimary: true,
      status: 'ACTIVE',
      endDate: null,
      employeeId: { not: employeeId },
      position: { reportsToPositionId },
    },
  })

  return peers
}
