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
 */
export async function isRequisitionApproverAllowed(args: {
  user: SessionUser
  approverRole: string | null
  requisition: RequisitionContext
}): Promise<boolean> {
  const { user, approverRole, requisition } = args

  // SUPER_ADMIN bypass: stuck flow 운영 override. 감사 로그는
  // RequisitionApproval.approverId/decidedAt에 그대로 기록되므로 추적 가능.
  if (user.role === 'SUPER_ADMIN') return true

  // Cross-tenant guard: 일반 role은 자체 법인만.
  if (user.companyId !== requisition.companyId) return false

  if (!approverRole) return false

  switch (approverRole) {
    case 'hr_admin':
      return user.role === 'HR_ADMIN'

    case 'ceo':
      return user.role === 'EXECUTIVE'

    case 'direct_manager': {
      // 사용자가 requester의 직속 상사인지 확인.
      //
      // 비대칭 정책 (direct-reports.ts:13 정합 — Session 204 secondary 지원):
      //   - mgr_asg: ALL active assignments (primary + secondary 모두) — 매니저가 보조 직책으로
      //     팀장직 보유 가능 (e.g., primary=일반팀원, secondary=타팀 팀장)
      //   - req_asg: primary only — 보고 라인은 primary 기반 (매트릭스 중복 매칭 방지)
      //
      // Self-approval guard: requester 자신이 manager position을 secondary로 보유한
      // 순환 구조에서도 본인 결재 차단 (Codex Gate 1 — secondary 변경 직접 동반).
      //
      // mgr_asg / req_asg 모두 동일 법인 + ACTIVE — myApprovals 필터의 directReportIds
      // 도출과 대칭 유지 (Codex Gate 2 R4 P2).
      const rows = await prisma.$queryRaw<Array<{ ok: number }>>`
        SELECT 1 AS ok
        FROM employee_assignments req_asg
        JOIN positions req_p ON req_p.id = req_asg.position_id
        JOIN positions mgr_p ON mgr_p.id = req_p.reports_to_position_id
        JOIN employee_assignments mgr_asg ON mgr_asg.position_id = mgr_p.id
          AND mgr_asg.end_date IS NULL
          AND mgr_asg.status = 'ACTIVE'
          AND mgr_asg.company_id = ${requisition.companyId}
        WHERE req_asg.employee_id = ${requisition.requesterId}
          AND req_asg.company_id = ${requisition.companyId}
          AND req_asg.is_primary = true
          AND req_asg.end_date IS NULL
          AND req_asg.status = 'ACTIVE'
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
