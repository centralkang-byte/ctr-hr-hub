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
import { getTodayForTimezone } from '@/lib/assignments'
import { parseDateOnly } from '@/lib/timezone'
import {
  acquirePrimaryAssignmentDepartmentLocks,
  acquirePrimaryAssignmentEmployeeLocks,
  assertPrimaryAssignmentSourceScopeLocked,
  casPrimaryAssignment,
  getPrimaryAssignmentAtDate,
  readPrimaryAssignmentTimeline,
  revalidatePrimaryAssignmentDepartments,
  validatePrimaryAssignmentTimeline,
  withPrimaryAssignmentRetry,
} from '@/lib/employee/primary-assignment-writer'
import type { SessionUser } from '@/types'

const VALID_ACTIONS = ['CONVERT_FULLTIME', 'RENEW_CONTRACT', 'TERMINATE'] as const
type ContractAction = (typeof VALID_ACTIONS)[number]

function parseStrictDateOnly(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw badRequest('newEndDate는 YYYY-MM-DD 형식이어야 합니다.')
  }
  const parsed = parseDateOnly(value)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw badRequest('newEndDate가 올바른 날짜가 아닙니다.')
  }
  return parsed
}

function nextDate(value: Date): Date {
  const next = new Date(value)
  next.setUTCDate(next.getUTCDate() + 1)
  return next
}

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

    const convertedAssignment = await withPrimaryAssignmentRetry(async () => {
      const assignmentHint = await prisma.employeeAssignment.findUnique({
        where: { id: assignment.id },
        select: { companyId: true, departmentId: true },
      })
      if (!assignmentHint) throw badRequest('계약직 주 발령 상태가 변경되었습니다.')
      const departmentScopes = [{
        companyId: assignmentHint.companyId,
        departmentId: assignmentHint.departmentId,
      }]

      return prisma.$transaction(async (tx) => {
        const lockedDepartmentKeys = await acquirePrimaryAssignmentDepartmentLocks(
          tx,
          departmentScopes,
        )
        await revalidatePrimaryAssignmentDepartments(tx, departmentScopes)
        await acquirePrimaryAssignmentEmployeeLocks(tx, [employeeId])
        const timeline = await readPrimaryAssignmentTimeline(tx, employeeId)
        const freshAssignment = timeline.find((row) => row.id === assignment.id)
        if (freshAssignment) {
          assertPrimaryAssignmentSourceScopeLocked(
            lockedDepartmentKeys,
            freshAssignment,
          )
        }
        if (
          !freshAssignment ||
          freshAssignment.employmentType !== 'CONTRACT' ||
          freshAssignment.status !== 'ACTIVE' ||
          freshAssignment.endDate === null ||
          freshAssignment.companyId !== assignment.companyId
        ) {
          throw badRequest('계약직 주 발령 상태가 변경되었습니다.')
        }

        const company = await tx.company.findFirst({
          where: { id: freshAssignment.companyId, deletedAt: null },
          select: { timezone: true },
        })
        if (!company) throw notFound('법인 정보를 찾을 수 없습니다.')
        const today = getTodayForTimezone(company.timezone)
        const renewedEndDate = body.newEndDate
          ? parseStrictDateOnly(body.newEndDate)
          : null
        const renewedAssignmentEnd = renewedEndDate ? nextDate(renewedEndDate) : null
        const nextEndDate = action === 'CONVERT_FULLTIME'
          ? null
          : action === 'RENEW_CONTRACT'
            ? renewedAssignmentEnd
            : today
        if (getPrimaryAssignmentAtDate(timeline, today)?.id !== freshAssignment.id) {
          throw badRequest('현재 유효한 계약직 주 발령만 처리할 수 있습니다.')
        }
        if (
          action === 'RENEW_CONTRACT' &&
          renewedEndDate &&
          renewedEndDate.getTime() <= today.getTime()
        ) {
          throw badRequest('계약 갱신 종료일은 오늘 이후여야 합니다.')
        }
        validatePrimaryAssignmentTimeline(
          timeline.map((row) =>
            row.id === freshAssignment.id ? { ...row, endDate: nextEndDate } : row,
          ),
        )

        const reason = body.comment ?? (
          action === 'CONVERT_FULLTIME'
            ? '계약직→정규직 전환'
            : action === 'RENEW_CONTRACT'
              ? '계약 갱신'
              : '계약 만료 종료'
        )
        await casPrimaryAssignment(tx, freshAssignment, {
          endDate: nextEndDate,
          changeType: 'CONTRACT_CHANGE',
          ...(action === 'CONVERT_FULLTIME' ? { employmentType: 'FULL_TIME' } : {}),
          ...(action === 'TERMINATE' ? { status: 'COMPLETED' } : {}),
          approvedById: user.employeeId,
          reason,
        })
        await tx.employee.update({
          where: { id: employeeId },
          data: {
            contractEndDate: action === 'CONVERT_FULLTIME'
              ? null
              : action === 'RENEW_CONTRACT'
                ? renewedEndDate
                : today,
          },
        })

        const lastContract = await tx.contractHistory.findFirst({
          where: { employeeId, companyId: freshAssignment.companyId },
          orderBy: { contractNumber: 'desc' },
          select: { contractNumber: true },
        })
        await tx.contractHistory.create({
          data: {
            employeeId,
            companyId: freshAssignment.companyId,
            contractNumber: (lastContract?.contractNumber ?? 0) + 1,
            contractType: action === 'CONVERT_FULLTIME' ? 'PERMANENT' : 'FIXED_TERM',
            startDate: now,
            endDate: action === 'RENEW_CONTRACT' ? renewedEndDate : null,
            autoConvertTriggered: false,
            signedBy: user.employeeId,
            signedAt: now,
            notes: body.comment,
          },
        })
        return tx.employeeAssignment.findUniqueOrThrow({
          where: { id: freshAssignment.id },
        })
      })
    })

    // ── 감사 로그 ──
    const meta = extractRequestMeta(req.headers)
    logAudit({
      actorId: user.employeeId,
      action: 'employee.contract.convert',
      resourceType: 'EmployeeAssignment',
      resourceId: convertedAssignment.id,
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
      assignmentId: convertedAssignment.id,
      action,
      evaluatedBy: user.employeeId,
    })
  },
  perm(MODULE.EMPLOYEES, ACTION.UPDATE),
)
