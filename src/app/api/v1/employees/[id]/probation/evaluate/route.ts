// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Probation Evaluate API
// PUT /api/v1/employees/[id]/probation/evaluate
//
// 규정 참조: CP-G-02-01 인사관리규정 제18~19조
// ApprovalFlow: module='probation' (direct_manager → dept_head)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, forbidden } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { sendNotification } from '@/lib/notifications'
import { validateApprover } from '@/lib/approval/resolve-approval-flow'
import type { SessionUser } from '@/types'

const VALID_DECISIONS = ['PASSED', 'FAILED', 'WAIVED'] as const
type ProbationDecision = (typeof VALID_DECISIONS)[number]

export const PUT = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id: employeeId } = await context.params
    const body = await req.json() as { decision?: string; comment?: string }

    // ── 입력 검증 ──
    if (!body.decision || !VALID_DECISIONS.includes(body.decision as ProbationDecision)) {
      throw badRequest('decision은 PASSED, FAILED, WAIVED 중 하나여야 합니다.')
    }
    const decision = body.decision as ProbationDecision

    // ── 대상 직원 조회 ──
    const employee = await prisma.employee.findFirst({
      where: {
        id: employeeId,
        deletedAt: null,
        probationStatus: 'IN_PROGRESS',
      },
      select: {
        id: true,
        name: true,
        probationEndDate: true,
        probationStatus: true,
        assignments: {
          where: { isPrimary: true, endDate: null, status: 'ACTIVE' },
          select: { companyId: true },
          take: 1,
        },
      },
    })

    if (!employee) {
      throw notFound('수습 중인 직원을 찾을 수 없습니다.')
    }

    const companyId = employee.assignments[0]?.companyId
    if (!companyId || companyId !== user.companyId) {
      throw forbidden('다른 법인 직원에 대한 수습 평가 권한이 없습니다.')
    }

    // ── ApprovalFlow 검증 ──
    const validation = await validateApprover('probation', companyId, employeeId, user.employeeId)

    if (!validation.allowed) {
      // ApprovalFlow 미설정 시 HR_ADMIN/SUPER_ADMIN fallback
      if (validation.noFlowConfigured) {
        if (!['HR_ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
          throw forbidden('수습 평가 승인 권한이 없습니다. (결재 플로우 미설정)')
        }
      } else {
        throw forbidden('수습 평가 승인 권한이 없습니다.')
      }
    }

    // ── 상태 업데이트 ──
    await prisma.employee.update({
      where: { id: employeeId },
      data: {
        probationStatus: decision,
        // WAIVED: 수습 면제 → probationEndDate 초기화
        ...(decision === 'WAIVED' ? { probationEndDate: null } : {}),
      },
    })

    // ── 감사 로그 ──
    const meta = extractRequestMeta(req.headers)
    logAudit({
      actorId: user.employeeId,
      action: 'employee.probation.evaluate',
      resourceType: 'Employee',
      resourceId: employeeId,
      companyId: user.companyId,
      changes: {
        decision,
        comment: body.comment,
        employeeName: employee.name,
        approvedVia: validation.matchedStep
          ? `ApprovalFlow step ${validation.matchedStep.stepOrder}`
          : 'RBAC fallback',
      },
      ...meta,
    })

    // ── 알림: 직원에게 결과 통보 ──
    const decisionLabel = { PASSED: '정규직 전환 확정', FAILED: '수습 미통과', WAIVED: '수습 면제' }
    sendNotification({
      employeeId,
      triggerType: 'PROBATION_RESULT',
      title: `수습 평가 결과: ${decisionLabel[decision]}`,
      body: `${employee.name}님의 수습 평가가 완료되었습니다. 결과: ${decisionLabel[decision]}`,
      titleKey: 'notifications.probation.result.title',
      bodyKey: 'notifications.probation.result.body',
      bodyParams: { name: employee.name, decision: decisionLabel[decision] },
      link: `/employees/${employeeId}`,
    })

    return apiSuccess({
      employeeId,
      decision,
      previousStatus: 'IN_PROGRESS',
      evaluatedBy: user.employeeId,
    })
  },
  perm(MODULE.EMPLOYEES, ACTION.UPDATE),
)
