// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Generic ApprovalFlow Resolver
// src/lib/approval/resolve-approval-flow.ts
//
// 모듈별 ApprovalFlow 조회 + approverRole → employeeId 해석
// 사용: 수습 평가, 계약 전환, 급여, 징계 등 모든 승인 라우트
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { findActiveRoleHolderId } from '@/lib/employee/active-roles'
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
      // 대상 직원의 primary position → reportsToPosition → 해당 position 보유 직원.
      //
      // 비대칭 정책 (direct-reports.ts:13 / validate-requisition-approver.ts:53 정합):
      //   - mgr_asg: ALL active assignments (primary + secondary 모두) — 매니저가
      //     보조 직책으로 팀장직 보유 가능 (e.g., primary=일반팀원, secondary=타팀 팀장)
      //   - ea (대상 직원): primary only — 보고 라인은 primary 기반
      //
      // Self-approval 정책 (기존 동작 + Session 204 secondary 지원 정합):
      //   - primary 매니저 position: self 포함 매칭 — 직원이 자기 매니저 position을
      //     primary로 보유한 hierarchy(rare)에서 기존 self-skip 자동 승인 경로 보존.
      //   - secondary 매니저 position: non-self만 매칭 — secondary로 자기 position을
      //     보유한 케이스에서 self-routing은 차단 (기존 is_primary-only 동작과 정합).
      //
      // 결정적 선택을 위해 ORDER BY 명시 (Codex Gate 2 R3 P1):
      //   1) is_primary DESC — primary 매니저가 있으면 항상 그를 우선 (기존 동작 보존)
      //   2) created_at ASC — 동일 우선순위 내 가장 오래된 assignment (안정된 매니저)
      //   3) employee_id ASC — 완전한 deterministic tie-breaker
      // → 같은 요청이 normal PENDING ↔ self-auto-approval 사이 oscillate 차단.
      // Validation 용도(다대일 정확 매칭)는 validateApprover의 별도 EXISTS 분기 참조.
      // 기존 동작 보존: ea(target)/mgr_asg 모두 status 조건 없음. Session 204의
      // validate-requisition-approver는 status='ACTIVE' 강제하지만, getDirectReportIds
      // (employee/direct-reports.ts:13)는 status 체크 안 함 — 본 generic resolver는
      // 후자와 정합 (PROBATION/ON_LEAVE 직원의 결재도 진행 가능). 추가 정합화는
      // caller 영향 평가 후 별도 PR.
      const rows = await prisma.$queryRaw<Array<{ manager_id: string }>>`
        SELECT mgr_asg.employee_id AS manager_id
        FROM employee_assignments ea
        JOIN positions p ON p.id = ea.position_id
        JOIN positions mgr_p ON mgr_p.id = p.reports_to_position_id
        JOIN employee_assignments mgr_asg ON mgr_asg.position_id = mgr_p.id
          AND mgr_asg.end_date IS NULL
          AND mgr_asg.company_id = ${companyId}
          AND (mgr_asg.is_primary = true OR mgr_asg.employee_id <> ${targetEmployeeId})
        WHERE ea.employee_id = ${targetEmployeeId}
          AND ea.company_id = ${companyId}
          AND ea.is_primary = true
          AND ea.end_date IS NULL
        ORDER BY mgr_asg.is_primary DESC, mgr_asg.created_at ASC, mgr_asg.employee_id ASC
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
      // Session 207 정합화 (findActiveRoleHolderId helper SSOT):
      //   - `Role.code` 기준 매칭 (기존 `Role.name='HR_ADMIN'`은 seed name='HR Admin'과
      //     불일치로 항상 0 row → silent routing 실패 버그였음).
      //   - `EmployeeRole.endDate=null` + `EmployeeRole.companyId` scope (기존 누락).
      //   - Assignment status `IN ('ACTIVE', 'ON_LEAVE')` (Session 206 정합).
      //   - Deterministic `orderBy: createdAt asc` (helper 내부 적용).
      return findActiveRoleHolderId(['HR_ADMIN'], companyId)
    }

    case 'ceo': {
      // SUPER_ADMIN 또는 EXECUTIVE 중 해당 법인 소속 — Session 207 정합화 동일 정책.
      // 기존 `Role.name in [...]` 매칭은 seed name('Super Admin'/'Executive')과 불일치
      // 였음. 본 PR로 `Role.code`로 정합 + Session 206 status allowlist 적용.
      return findActiveRoleHolderId(['SUPER_ADMIN', 'EXECUTIVE'], companyId)
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
      // direct_manager validation은 routing(LIMIT 1)보다 넓은 인증 정책을 채택:
      // primary 매니저 + secondary 매니저(둘 다 reportsTo position 보유) 어느 쪽도
      // 결재 인정. 이는 Session 204 패턴(validate-requisition-approver.ts:53)의
      // generic 적용 — matrix 조직 dotted-line 매니저 지원.
      //
      // Race 안전성: 같은 step을 두 매니저가 동시 결재해도 caller route가
      // status='PENDING' 조건으로 step 찾음 → 첫 결재 후 즉시 APPROVED로 전환되어
      // 둘째 결재 시도는 "현재 승인 단계를 찾을 수 없습니다" badRequest.
      //
      // Self-approval 정책은 isDirectManagerOf docstring 참조.
      if (step.approverRole === 'direct_manager') {
        const matched = await isDirectManagerOf({
          targetEmployeeId,
          companyId,
          candidateEmployeeId: currentUserId,
        })
        if (matched) {
          return { allowed: true, matchedStep: step, noFlowConfigured: false }
        }
        continue
      }

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

/**
 * candidateEmployeeId가 targetEmployeeId의 직속 상사인지 확인 (validation 전용).
 *
 * 비대칭 정책(mgr_asg ALL active / ea primary only)은 resolveApproverByRole의
 * direct_manager case와 동일. 차이점은 LIMIT 1로 단일 ID를 반환하는 대신 EXISTS만
 * 검사 — multi-manager 시(primary 매니저 + secondary 매니저 모두 보유) 어느 한 명이
 * candidate여도 true (LIMIT 1 비결정성 회피).
 *
 * Self-approval 정책 (resolveApproverByRole와 동일):
 *   - primary 매니저 position: self 포함 매칭 — 기존 primary-only 동작 보존.
 *   - secondary 매니저 position: non-self만 매칭 — secondary self-position을 통한
 *     authorization escalation 차단 (Codex Gate 2 R4 P1).
 *
 * 셀프 결재 정책이 더 엄격해야 하는 모듈(예: requisition)은 별도 helper
 * (isRequisitionApproverAllowed)에서 추가 self-guard 적용.
 */
async function isDirectManagerOf(args: {
  targetEmployeeId: string
  companyId: string
  candidateEmployeeId: string
}): Promise<boolean> {
  const { targetEmployeeId, companyId, candidateEmployeeId } = args

  // resolveApproverByRole의 direct_manager case와 동일한 status 정책 (status 조건 없음).
  const rows = await prisma.$queryRaw<Array<{ ok: number }>>`
    SELECT 1 AS ok
    FROM employee_assignments ea
    JOIN positions p ON p.id = ea.position_id
    JOIN positions mgr_p ON mgr_p.id = p.reports_to_position_id
    JOIN employee_assignments mgr_asg ON mgr_asg.position_id = mgr_p.id
      AND mgr_asg.end_date IS NULL
      AND mgr_asg.company_id = ${companyId}
      AND mgr_asg.employee_id = ${candidateEmployeeId}
      AND (mgr_asg.is_primary = true OR mgr_asg.employee_id <> ${targetEmployeeId})
    WHERE ea.employee_id = ${targetEmployeeId}
      AND ea.company_id = ${companyId}
      AND ea.is_primary = true
      AND ea.end_date IS NULL
    LIMIT 1
  `
  return rows.length > 0
}
