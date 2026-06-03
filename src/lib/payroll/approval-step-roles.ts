// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 급여 승인 단계 role 보유 검증 (회사 단위)
// src/lib/payroll/approval-step-roles.ts
//
// ApprovalFlow의 추상 approverRole(hr_admin/ceo/finance)을 시스템 role.code/
// 권한으로 매핑해 "호출자가 현 단계를 승인/반려할 자격을 보유하는가"를 검증.
// payroll run은 전사 단위라 회사 단위로 해석되는 role만 사용 (dept_head/direct_manager
// 같은 대상-직원 기준 role은 부적합 — resolveApprovalFlow 참조).
//
// approve/route.ts · reject/route.ts 공용 (SoD 일관).
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'

// 추상 approverRole → 시스템 role.code 집합
const PAYROLL_STEP_ROLE_CODES: Record<string, string[]> = {
    hr_admin: ['HR_ADMIN'],
    ceo: ['SUPER_ADMIN', 'EXECUTIVE'],
}

/**
 * 호출자(employeeId)가 현 단계가 요구하는 추상 role을 회사 scope에서 보유하는가.
 * - finance: payroll:manage 권한 보유자 (재무/급여 관리)
 * - hr_admin/ceo: 위 매핑 role.code 보유
 * - 그 외(커스텀 flow의 literal role.code): 그대로 매칭 (하위호환)
 */
export async function callerHoldsPayrollStepRole(
    roleRequired: string,
    employeeId: string,
    companyId: string,
): Promise<boolean> {
    if (roleRequired === 'finance') {
        const count = await prisma.employeeRole.count({
            where: {
                employeeId,
                endDate: null,
                companyId,
                role: {
                    rolePermissions: {
                        some: { permission: { module: 'payroll', action: 'manage' } },
                    },
                },
            },
        })
        return count > 0
    }
    const codes = PAYROLL_STEP_ROLE_CODES[roleRequired] ?? [roleRequired]
    const count = await prisma.employeeRole.count({
        where: { employeeId, endDate: null, companyId, role: { code: { in: codes } } },
    })
    return count > 0
}
