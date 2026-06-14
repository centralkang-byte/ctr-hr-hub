// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Performance/CFR Viewer Access SSOT
// src/lib/performance/peer-access.ts
//
// "현재 담당 매니저" 및 직원 성과 데이터 열람 권한 판정 단일 출처.
// 동료평가 결과·지명·AI초안·체크인 등 employeeId 스코프 엔드포인트가
// 공유한다. 읽기·쓰기 게이트가 서로 다른 정의로 drift 하지 않도록 한 곳에 둔다.
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { isDirectManager } from '@/lib/auth/manager-check'

const PRIVILEGED_VIEWER_ROLES = new Set(['SUPER_ADMIN', 'HR_ADMIN', 'EXECUTIVE'])

/**
 * "현재 담당 매니저" 판정 — 전임 매니저 영구 권한 결함 방지.
 *
 * 과거 1:1 기록 1건만으로 매니저로 보던 결함을 "현재 담당" 2-경로(OR)로 한정:
 *   (1) 활성 보고라인 — Position.reportsToPositionId(endDate:null) 기준 직속 매니저
 *       (isDirectManager — offboarding 격리와 동일한 manager-of-record SSOT).
 *   (2) 해당 cycle 스코프 CFR — 이번 평가 주기에 연결된 1:1(OneOnOne.cycleId === cycleId).
 *       OneOnOne엔 endDate/active 개념이 없어 cycleId로 시간 범위를 한정한다
 *       (과거 주기·무관 주기 1:1은 불인정). cycleId 미지정 시 (1)만 평가.
 *
 * HR/임원/SUPER 우회는 여기서 다루지 않는다(역할 게이트는 호출부 또는
 * canViewEmployeePerformance 참조).
 */
export async function isCurrentManagerOf(
    userEmployeeId: string,
    targetEmployeeId: string,
    cycleId?: string,
): Promise<boolean> {
    if (userEmployeeId === targetEmployeeId) return false
    const [isReportingLineManager, cycleScopedCfrCount] = await Promise.all([
        isDirectManager(userEmployeeId, targetEmployeeId),
        cycleId
            ? prisma.oneOnOne.count({
                  where: { managerId: userEmployeeId, employeeId: targetEmployeeId, cycleId },
              })
            : Promise.resolve(0),
    ])
    return isReportingLineManager || cycleScopedCfrCount > 0
}

/**
 * 직원 성과/CFR 데이터 열람 권한 — 본인 · 현재 담당 매니저 · HR/임원/SUPER.
 * 전임 매니저·무관한 직원은 false. employeeId 스코프 IDOR 게이트의 SSOT.
 *
 * 주의: 본인(EMPLOYEE) 허용은 "타인 차단" 목적이며, 결과 공개(publication)
 * 여부는 별도 게이트(isResultPublishedForRole)에서 다룬다.
 */
export async function canViewEmployeePerformance(
    user: { employeeId: string; role: string },
    targetEmployeeId: string,
    cycleId?: string,
): Promise<boolean> {
    if (user.employeeId === targetEmployeeId) return true
    if (PRIVILEGED_VIEWER_ROLES.has(user.role)) return true
    return isCurrentManagerOf(user.employeeId, targetEmployeeId, cycleId)
}
