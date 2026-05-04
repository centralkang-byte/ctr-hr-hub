// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Requisition Approver Validator
// src/lib/approval/validate-requisition-approver.ts
//
// 채용 요청(Requisition) 결재 라우트 전용. 현재 단계의 approverRole에
// 대해 사용자가 실제 승인자인지 per-step 검증한다.
//
// 일반 validateApprover()는 ALL steps any-match라 CEO가 dept_head step을
// 결재하는 out-of-order 위험이 있어 별도 헬퍼로 분리.
//
// myApprovals 필터(src/app/api/v1/recruitment/requisitions/route.ts:75-215)와
// 동일한 정책 — 두 곳을 함께 유지보수해야 한다.
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import {
  getActiveRoleCodes,
  buildEffectiveRoleCodes,
  getEligibleApproverRolesForRequisition,
} from '@/lib/employee/active-roles'
import type { SessionUser } from '@/types'

interface RequisitionContext {
  companyId: string
  departmentId: string
  requesterId: string
}

/**
 * 채용 요청 현재 결재 단계의 승인자인지 확인한다.
 *
 * - SUPER_ADMIN: 모든 단계 bypass (운영 차원 stuck flow override).
 * - 그 외 role: cross-tenant guard 후 approverRole별 매칭.
 *
 * Session 207 멀티롤 지원: SessionUser.role은 `EmployeeRole.findFirst({ orderBy:
 * startDate desc })`로 단일 pin이라 보조 role(예: MANAGER + HR_ADMIN 동시 보유)의
 * 결재가 누락. hr_admin/ceo 분기에서 active EmployeeRoles를 union해 effectiveRoleCodes
 * 기준으로 검증. myApprovals list filter와 동일 매퍼(getEligibleApproverRolesForRequisition)
 * 사용 → list/validator drift 차단.
 *
 * Detail page UI 후속 (Codex Gate 2 R3 P2 — STATUS.md follow-up):
 *   detail page의 canApproveRequisition(Session 203 helper)은 user.role 기반이라
 *   multi-role 사용자(예: session.role=HR_ADMIN + active EXECUTIVE)는 server가 ceo
 *   step 결재를 허용하지만 detail page 버튼이 비활성. 우회 경로: list myApprovals 탭
 *   → 결재 모달. UI 일치는 별도 PR(canApproveRequisition을 multi-role 인지하도록
 *   refactor 또는 server-derived `canApprove` prop drill).
 */
export async function isRequisitionApproverAllowed(args: {
  user: SessionUser
  approverRole: string | null
  requisition: RequisitionContext
}): Promise<boolean> {
  const { user, approverRole, requisition } = args

  // SUPER_ADMIN session bypass — 기존 cross-company 결재 path 보존 (Session 207
  // Codex Gate 2 R1 P1). myApprovals route는 SUPER_ADMIN + companyId 쿼리파라미터로
  // 명시적 cross-company 결재 허용; 본 함수도 그 흐름과 정합. JWT에 SUPER_ADMIN으로
  // pin된 세션만 cross-company bypass.
  //
  // Stale-session SUPER_ADMIN (active EmployeeRole에 SUPER_ADMIN 보유했지만 JWT가
  // EMPLOYEE로 stale pin)은 *bypass하지 않음* — myApprovals list filter는 stale
  // session 인지 안 하므로 validator만 bypass하면 list/validator drift (Codex Gate 2
  // R2 P2). stale session 사용자는 JWT 재발급(re-login)으로 SUPER_ADMIN 정상 활용.
  // hr_admin/ceo 같은 일반 멀티롤은 list/validator 양쪽이 동일 helper로 보강하므로
  // drift 없음.
  if (user.role === 'SUPER_ADMIN') return true

  // Cross-tenant guard: SUPER_ADMIN이 아닌 경우 자체 법인 한정. active role 조회가
  // cross-tenant scope 누수가 되지 않도록 helper 호출 전에 차단.
  if (user.companyId !== requisition.companyId) return false

  // Effective role set: SessionUser.role(JWT pin) ∪ active EmployeeRoles(DB SSOT).
  // 멀티롤(MANAGER + HR_ADMIN 동시 보유) 보강 — list filter (route.ts myApprovals)와
  // 동일 helper(getEligibleApproverRolesForRequisition)로 매핑 일치.
  const activeRoleCodes = await getActiveRoleCodes(
    user.employeeId,
    requisition.companyId,
  )
  const effectiveRoleCodes = buildEffectiveRoleCodes(activeRoleCodes, user.role)

  if (!approverRole) return false

  // hr_admin/ceo step은 매퍼 SSOT(getEligibleApproverRolesForRequisition)로 검증 —
  // myApprovals list filter와 동일 매핑이라 drift 차단. SUPER_ADMIN을 stale session
  // 형태로 보유한 경우 hr_admin/ceo step은 자동 통과 (list도 surface하므로 정합).
  // direct_manager / dept_head는 매퍼 무관 (실제 관계 검증 — 아래 case에서 처리).
  const eligibleStepRoles = getEligibleApproverRolesForRequisition(effectiveRoleCodes)

  switch (approverRole) {
    case 'hr_admin':
      return eligibleStepRoles.includes('hr_admin')

    case 'ceo':
      return eligibleStepRoles.includes('ceo')

    case 'direct_manager': {
      // 사용자가 requester의 직속 상사인지 확인.
      //
      // 비대칭 정책 (direct-reports.ts 정합 — Session 204 secondary 지원):
      //   - mgr_asg: ALL current assignments (primary + secondary 모두) — 매니저가 보조 직책으로
      //     팀장직 보유 가능 (e.g., primary=일반팀원, secondary=타팀 팀장)
      //   - req_asg: primary only — 보고 라인은 primary 기반 (매트릭스 중복 매칭 방지)
      //
      // "현재" assignment 정의 (Session 206 정합화 + Codex Gate 2 P1):
      //   - `endDate IS NULL AND status IN ('ACTIVE', 'ON_LEAVE')` allowlist.
      //   - ON_LEAVE 매니저/요청자 포함 → 휴직 중 결재 stuck 방지.
      //   - RESIGNED/TERMINATED 제외 → `offboarding/start`가 status만 변경하고
      //     endDate=null로 두는 in-progress offboarding 직원도 차단
      //     (endDate=null 만으로는 lifecycle 식별 부족).
      //   - getDirectReportIds(direct-reports.ts) + resolve-approval-flow.ts:81
      //     generic resolver와 동일한 canonical (CURRENT_STATUSES 상수).
      //
      // Trade-off — in-flight 결재 stuck (Codex Gate 2 R2 P1, acknowledged):
      //   - 결재 진행 중 매니저/요청자 offboarding 시 RESIGNED/TERMINATED 차단으로
      //     해당 step이 stuck. 기존 Session 204의 status='ACTIVE' 동작과 동일 — 본 PR이
      //     새 회귀를 도입한 게 아니라 기존 동작을 ON_LEAVE 포함하는 allowlist로 완화 +
      //     RESIGNED/TERMINATED 차단을 명시화.
      //   - 운영 차원 해소: SUPER_ADMIN bypass(라인 39 `user.role === 'SUPER_ADMIN' → true`)
      //     로 stuck 결재 override.
      //   - Structural fix: requisition 생성 시점에 결재자를 employeeId로 snapshot하거나,
      //     offboarding 트리거가 in-flight 결재를 다음 매니저로 reroute하는 워크플로 도입.
      //     본 PR scope 외 — STATUS.md Session 206 follow-up.
      //
      // Self-approval guard: requester 자신이 manager position을 secondary로 보유한
      // 순환 구조에서도 본인 결재 차단 (mgr_asg.employee_id <> requesterId).
      //
      // mgr_asg / req_asg 모두 동일 법인 (cross-tenant guard).
      const rows = await prisma.$queryRaw<Array<{ ok: number }>>`
        SELECT 1 AS ok
        FROM employee_assignments req_asg
        JOIN positions req_p ON req_p.id = req_asg.position_id
        JOIN positions mgr_p ON mgr_p.id = req_p.reports_to_position_id
        JOIN employee_assignments mgr_asg ON mgr_asg.position_id = mgr_p.id
          AND mgr_asg.end_date IS NULL
          AND mgr_asg.status IN ('ACTIVE', 'ON_LEAVE')
          AND mgr_asg.company_id = ${requisition.companyId}
        WHERE req_asg.employee_id = ${requisition.requesterId}
          AND req_asg.company_id = ${requisition.companyId}
          AND req_asg.is_primary = true
          AND req_asg.end_date IS NULL
          AND req_asg.status IN ('ACTIVE', 'ON_LEAVE')
          AND mgr_asg.employee_id = ${user.employeeId}
          AND mgr_asg.employee_id <> ${requisition.requesterId}
        LIMIT 1
      `
      return rows.length > 0
    }

    case 'dept_head': {
      // requisition.departmentId의 head가 사용자인지 확인.
      // companyId 명시 — Department 자체엔 companyId가 있으므로 cross-tenant 차단.
      const dept = await prisma.department.findFirst({
        where: {
          id: requisition.departmentId,
          companyId: requisition.companyId,
          headEmployeeId: user.employeeId,
          deletedAt: null,
        },
        select: { id: true },
      })
      return !!dept
    }

    default:
      // specific_user 등 미지원 — Requisition 생성 시 approverRole만 저장하므로
      // 이 경로에 도달하지 않음. 알려지지 않은 role은 안전하게 deny.
      return false
  }
}
