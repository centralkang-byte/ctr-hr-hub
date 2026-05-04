// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Generic ApprovalFlow Resolver
// src/lib/approval/resolve-approval-flow.ts
//
// 모듈별 ApprovalFlow 조회 + approverRole → employeeId 해석
// 사용: 수습 평가, 계약 전환, 급여, 징계 등 모든 승인 라우트
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import type { ApprovalModule, ApproverRole } from '@/types/settings'

// ─── ApprovalFlow 조회 ────────────────────────────────────

export interface ResolvedStep {
  stepOrder: number
  approverRole: ApproverRole | null
  approverUserId: string | null
  approverType: string
  isRequired: boolean
  autoApproveDays: number | null
}

/**
 * 특정 모듈의 ApprovalFlow를 조회한다.
 * 우선순위: 법인 오버라이드 > 글로벌 기본값
 */
export async function resolveApprovalFlow(
  module: ApprovalModule,
  companyId: string | null,
): Promise<ResolvedStep[]> {
  const flow = await prisma.approvalFlow.findFirst({
    where: {
      module,
      deletedAt: null,
      OR: companyId
        ? [{ companyId }, { companyId: null }]
        : [{ companyId: null }],
    },
    include: { steps: { orderBy: { stepOrder: 'asc' } } },
    // 법인 오버라이드 우선 (PostgreSQL: NULL LAST in asc → 법인 레코드가 먼저)
    orderBy: { companyId: 'asc' },
  })

  if (!flow || flow.steps.length === 0) return []

  return flow.steps.map((s) => ({
    stepOrder: s.stepOrder,
    approverRole: (s.approverRole as ApproverRole) ?? null,
    approverUserId: s.approverUserId,
    approverType: s.approverType,
    isRequired: s.isRequired,
    autoApproveDays: s.autoApproveDays,
  }))
}

// ─── approverRole → employeeId 해석 ──────────────────────

/**
 * approverRole(직급)을 실제 employeeId로 해석한다.
 *
 * - direct_manager: 대상 직원의 Position.reportsToPositionId 기반 상사
 * - dept_head: 대상 직원 소속 부서의 headId
 * - hr_admin: 해당 법인의 HR_ADMIN 역할 보유 직원 (첫 번째)
 * - ceo: 해당 법인의 SUPER_ADMIN 또는 EXECUTIVE 역할 보유 직원
 * - finance: 해당 법인의 payroll 권한 보유 직원
 */
export async function resolveApproverByRole(
  role: ApproverRole,
  targetEmployeeId: string,
  companyId: string,
): Promise<string | null> {
  switch (role) {
    case 'direct_manager': {
      // Raw SQL: 대상 직원 → Position → reportsToPosition → 해당 Position 보유 직원
      const rows = await prisma.$queryRaw<Array<{ manager_id: string }>>`
        SELECT mgr_asg.employee_id AS manager_id
        FROM employee_assignments ea
        JOIN positions p ON p.id = ea.position_id
        JOIN positions mgr_p ON mgr_p.id = p.reports_to_position_id
        JOIN employee_assignments mgr_asg ON mgr_asg.position_id = mgr_p.id
          AND mgr_asg.is_primary = true AND mgr_asg.end_date IS NULL
        WHERE ea.employee_id = ${targetEmployeeId}
          AND ea.company_id = ${companyId}
          AND ea.is_primary = true AND ea.end_date IS NULL
        LIMIT 1
      `
      return rows[0]?.manager_id ?? null
    }

    case 'dept_head': {
      // 대상 직원 소속 부서 → department.headEmployeeId (Session 201)
      //
      // KNOWN LIMITATION (follow-up): 이 함수가 반환하는 dept_head employeeId가
      // 실제로 결재 라우트에 접근할 RBAC 권한을 보유하는지는 별도 가드 필요.
      // 예: recruitment requisition의 dept_head step → /requisitions/[id]/approve는
      // recruitment_update 권한 요구. 부서장이 MANAGER role이면 seed RBAC 상
      // 해당 권한 없음 → 결재 stall 가능. 해결 방향:
      //   (a) MANAGER/EXECUTIVE에 module-specific approve 권한 추가
      //   (b) approve 라우트를 withAuth + route-local allowlist + validateApprover
      //       조합으로 전환 (Session 187/196 패턴)
      // Session 200 "Approve route 권한 검증 강화" follow-up과 함께 일괄 처리.
      const assignment = await prisma.employeeAssignment.findFirst({
        where: {
          employeeId: targetEmployeeId,
          companyId,
          isPrimary: true,
          endDate: null,
        },
        select: {
          department: { select: { headEmployeeId: true } },
        },
      })
      return assignment?.department?.headEmployeeId ?? null
    }

    case 'hr_admin': {
      const emp = await prisma.employee.findFirst({
        where: {
          deletedAt: null,
          assignments: {
            some: { companyId, status: 'ACTIVE', isPrimary: true, endDate: null },
          },
          employeeRoles: { some: { role: { name: 'HR_ADMIN' } } },
        },
        select: { id: true },
      })
      return emp?.id ?? null
    }

    case 'ceo': {
      // SUPER_ADMIN 또는 EXECUTIVE 중 해당 법인 소속
      const emp = await prisma.employee.findFirst({
        where: {
          deletedAt: null,
          assignments: {
            some: { companyId, status: 'ACTIVE', isPrimary: true, endDate: null },
          },
          employeeRoles: {
            some: { role: { name: { in: ['SUPER_ADMIN', 'EXECUTIVE'] } } },
          },
        },
        select: { id: true },
        orderBy: { createdAt: 'asc' }, // 가장 오래된 = 대표
      })
      return emp?.id ?? null
    }

    case 'finance': {
      // payroll manage 권한 보유 직원
      const emp = await prisma.employee.findFirst({
        where: {
          deletedAt: null,
          assignments: {
            some: { companyId, status: 'ACTIVE', isPrimary: true, endDate: null },
          },
          employeeRoles: {
            some: {
              role: {
                rolePermissions: {
                  some: { permission: { module: 'payroll', action: 'manage' } },
                },
              },
            },
          },
        },
        select: { id: true },
      })
      return emp?.id ?? null
    }

    default:
      return null
  }
}

// ─── 승인 권한 검증 ──────────────────────────────────────

export interface ApproverValidation {
  allowed: boolean
  matchedStep?: ResolvedStep
  /** ApprovalFlow가 미설정인 경우 true */
  noFlowConfigured: boolean
}

/**
 * 현재 사용자가 특정 모듈의 ApprovalFlow 상 승인 권한이 있는지 검증한다.
 * 첫 번째 step부터 순서대로 해석하여, 현재 사용자와 일치하면 allowed: true.
 *
 * ApprovalFlow가 미설정이면 noFlowConfigured: true를 반환하여
 * 호출자가 fallback 로직(RBAC 등)을 적용할 수 있게 한다.
 */
export async function validateApprover(
  module: ApprovalModule,
  companyId: string,
  targetEmployeeId: string,
  currentUserId: string,
): Promise<ApproverValidation> {
  const steps = await resolveApprovalFlow(module, companyId)

  if (steps.length === 0) {
    return { allowed: false, noFlowConfigured: true }
  }

  // 각 step의 approverRole을 employeeId로 해석하여 현재 사용자와 비교
  for (const step of steps) {
    if (step.approverType === 'specific_user') {
      if (step.approverUserId === currentUserId) {
        return { allowed: true, matchedStep: step, noFlowConfigured: false }
      }
      continue
    }

    // role 기반
    if (step.approverRole) {
      const resolverId = await resolveApproverByRole(
        step.approverRole,
        targetEmployeeId,
        companyId,
      )
      if (resolverId === currentUserId) {
        return { allowed: true, matchedStep: step, noFlowConfigured: false }
      }
    }
  }

  return { allowed: false, noFlowConfigured: false }
}
