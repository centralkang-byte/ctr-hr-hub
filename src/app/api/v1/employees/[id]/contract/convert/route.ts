// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Contract Convert API
// PUT /api/v1/employees/[id]/contract/convert
//
// 규정 참조: CP-G-02-01 인사관리규정 제15조
// ApprovalFlow: module='contract_conversion' (direct_manager → dept_head)
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

const VALID_ACTIONS = ['CONVERT_FULLTIME', 'RENEW_CONTRACT', 'TERMINATE'] as const
type ContractAction = (typeof VALID_ACTIONS)[number]

export const PUT = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id: employeeId } = await context.params
    const body = await req.json() as {
      action?: string
      newEndDate?: string
      comment?: string
    }

    // ── 입력 검증 ──
    if (!body.action || !VALID_ACTIONS.includes(body.action as ContractAction)) {
      throw badRequest('action은 CONVERT_FULLTIME, RENEW_CONTRACT, TERMINATE 중 하나여야 합니다.')
    }
    const action = body.action as ContractAction

    if (action === 'RENEW_CONTRACT' && !body.newEndDate) {
      throw badRequest('계약 갱신 시 newEndDate는 필수입니다.')
    }

    // ── 현재 CONTRACT assignment 조회 ──
    const assignment = await prisma.employeeAssignment.findFirst({
      where: {
        employeeId,
        employmentType: 'CONTRACT',
        isPrimary: true,
        endDate: { not: null },
        status: 'ACTIVE',
      },
      include: {
        employee: { select: { id: true, name: true, deletedAt: true } },
      },
      orderBy: { effectiveDate: 'desc' },
    })

    if (!assignment || assignment.employee.deletedAt) {
      throw notFound('활성 계약직 인사발령을 찾을 수 없습니다.')
    }

    if (assignment.companyId !== user.companyId) {
      throw forbidden('다른 법인 직원에 대한 계약 전환 권한이 없습니다.')
    }

    // ── ApprovalFlow 검증 ──
    const validation = await validateApprover(
      'contract_conversion', assignment.companyId, employeeId, user.employeeId,
    )

    if (!validation.allowed) {
      if (validation.noFlowConfigured) {
        if (!['HR_ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
          throw forbidden('계약 전환 승인 권한이 없습니다. (결재 플로우 미설정)')
        }
      } else {
        throw forbidden('계약 전환 승인 권한이 없습니다.')
      }
    }

    // ── action별 처리 ──
    const now = new Date()

    if (action === 'CONVERT_FULLTIME') {
      // 정규직 전환: employmentType → FULL_TIME, endDate → null
      await prisma.employeeAssignment.update({
        where: { id: assignment.id },
        data: {
          employmentType: 'FULL_TIME',
          endDate: null,
          changeType: 'CONTRACT_CHANGE',
          approvedBy: user.employeeId,
          reason: body.comment ?? '계약직→정규직 전환',
        },
      })
    } else if (action === 'RENEW_CONTRACT') {
      // 계약 갱신: endDate 업데이트
      await prisma.employeeAssignment.update({
        where: { id: assignment.id },
        data: {
          endDate: new Date(body.newEndDate!),
          changeType: 'CONTRACT_CHANGE',
          approvedBy: user.employeeId,
          reason: body.comment ?? '계약 갱신',
        },
      })
    } else {
      // TERMINATE: 계약 종료
      await prisma.employeeAssignment.update({
        where: { id: assignment.id },
        data: {
          endDate: now,
          status: 'COMPLETED',
          changeType: 'CONTRACT_CHANGE',
          approvedBy: user.employeeId,
          reason: body.comment ?? '계약 만료 종료',
        },
      })
    }

    // ── ContractHistory 기록 ──
    const lastContract = await prisma.contractHistory.findFirst({
      where: { employeeId, companyId: assignment.companyId },
      orderBy: { contractNumber: 'desc' },
      select: { contractNumber: true },
    })

    await prisma.contractHistory.create({
      data: {
        employeeId,
        companyId: assignment.companyId,
        contractNumber: (lastContract?.contractNumber ?? 0) + 1,
        contractType: action === 'CONVERT_FULLTIME' ? 'PERMANENT' : 'FIXED_TERM',
        startDate: now,
        endDate: action === 'RENEW_CONTRACT' ? new Date(body.newEndDate!) : null,
        autoConvertTriggered: false,
        signedBy: user.employeeId,
        signedAt: now,
        notes: body.comment,
      },
    })

    // ── 감사 로그 ──
    const meta = extractRequestMeta(req.headers)
    logAudit({
      actorId: user.employeeId,
      action: 'employee.contract.convert',
      resourceType: 'EmployeeAssignment',
      resourceId: assignment.id,
      companyId: user.companyId,
      changes: {
        action,
        employeeName: assignment.employee.name,
        newEndDate: body.newEndDate,
        comment: body.comment,
        approvedVia: validation.matchedStep
          ? `ApprovalFlow step ${validation.matchedStep.stepOrder}`
          : 'RBAC fallback',
      },
      ...meta,
    })

    // ── 알림 ──
    const actionLabel = {
      CONVERT_FULLTIME: '정규직 전환',
      RENEW_CONTRACT: '계약 갱신',
      TERMINATE: '계약 종료',
    }
    sendNotification({
      employeeId,
      triggerType: 'CONTRACT_CONVERSION_RESULT',
      title: `계약 처리 결과: ${actionLabel[action]}`,
      body: `${assignment.employee.name}님의 계약이 처리되었습니다. 결과: ${actionLabel[action]}`,
      titleKey: 'notifications.contract.result.title',
      bodyKey: 'notifications.contract.result.body',
      bodyParams: { name: assignment.employee.name, action: actionLabel[action] },
      link: `/employees/${employeeId}`,
    })

    return apiSuccess({
      employeeId,
      assignmentId: assignment.id,
      action,
      evaluatedBy: user.employeeId,
    })
  },
  perm(MODULE.EMPLOYEES, ACTION.UPDATE),
)
