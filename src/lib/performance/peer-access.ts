// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Performance/CFR Viewer Access SSOT
// src/lib/performance/peer-access.ts
//
// "현재 담당 매니저" 및 직원 성과 데이터 열람 권한 판정 단일 출처.
// 동료평가 결과·지명·AI초안·체크인 등 employeeId 스코프 엔드포인트가
// 공유한다. 읽기·쓰기 게이트가 서로 다른 정의로 drift 하지 않도록 한 곳에 둔다.
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'

const PRIVILEGED_VIEWER_ROLES = new Set(['SUPER_ADMIN', 'HR_ADMIN', 'EXECUTIVE'])

/**
 * 활성 보고라인 직속 매니저 판정 (정확 매칭 — 부서 fallback 없음).
 *
 * target의 활성 primary 발령 position.reportsToPositionId 를 user가 활성 primary로
 * 보유하면 true. 권한 결정에 쓰이므로 신뢰 가능한 관계만 인정한다:
 *   - reportsToPositionId 부재 시 false(fail-closed) — `isDirectManager`의 부서
 *     fallback("같은 부서 + position 보유 = 매니저")은 동료에게 매니저 권한을
 *     over-grant 하므로 사용하지 않는다 (Codex Gate2 P1).
 *   - cycle-scoped 1:1(OneOnOne)도 신호로 쓰지 않는다 — `/performance/checkins`
 *     POST(withAuth)로 임의 직원이 자기 자신을 managerId로 하는 체크인 1:1을
 *     위조할 수 있어 권한 escalation 경로가 된다 (Codex Gate2 P1).
 * 전임 매니저는 활성 보고라인에서 빠지므로 자동 배제된다.
 *
 * 방향: target의 **primary** 발령 position이 보고하는 상위 position을, user가
 * **primary 또는 secondary** 활성 발령으로 보유하면 매니저(getDirectReportIds와 동일
 * 규칙 — 매니저가 팀장직을 secondary로 겸직하는 케이스 인정; manager 측 isPrimary 강제 금지).
 */
async function isReportingLineManager(
    userEmployeeId: string,
    targetEmployeeId: string,
): Promise<boolean> {
    const target = await prisma.employeeAssignment.findFirst({
        where: { employeeId: targetEmployeeId, isPrimary: true, endDate: null },
        select: { position: { select: { reportsToPositionId: true } } },
    })
    const reportsToPositionId = target?.position?.reportsToPositionId
    if (!reportsToPositionId) return false

    // manager 측은 primary+secondary 모두 인정 (endDate:null 활성만). isPrimary 강제 시
    // 팀장직을 secondary로 보유한 정당한 매니저가 403 (Codex Gate2 P1 회귀).
    const managerAssignment = await prisma.employeeAssignment.findFirst({
        where: {
            employeeId: userEmployeeId,
            positionId: reportsToPositionId,
            endDate: null,
        },
        select: { id: true },
    })
    return !!managerAssignment
}

/**
 * "현재 담당 매니저" 판정 SSOT — 전임 매니저 영구 권한 결함 방지.
 * 활성 보고라인(Position.reportsToPositionId·endDate:null)만 신뢰한다.
 * HR/임원/SUPER 우회는 여기서 다루지 않는다(canViewEmployeePerformance 참조).
 */
export async function isCurrentManagerOf(
    userEmployeeId: string,
    targetEmployeeId: string,
): Promise<boolean> {
    if (userEmployeeId === targetEmployeeId) return false
    return isReportingLineManager(userEmployeeId, targetEmployeeId)
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
): Promise<boolean> {
    if (user.employeeId === targetEmployeeId) return true
    if (PRIVILEGED_VIEWER_ROLES.has(user.role)) return true
    return isCurrentManagerOf(user.employeeId, targetEmployeeId)
}
