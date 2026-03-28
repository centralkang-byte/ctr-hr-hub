// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET/PATCH /api/v1/leave-of-absence/[id]
// 휴직 상세 조회 + 상태 전이 (approve/reject/activate/return/complete/cancel)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { sendNotification } from '@/lib/notifications'
import type { SessionUser } from '@/types'
import { createCrossMonthLoaAdjustments, reconcileLoaAdjustments } from '@/lib/loa/payroll-adjustment'

type RouteContext = { params: Promise<Record<string, string>> }

// 허용된 상태 전이 맵
const VALID_TRANSITIONS: Record<string, string[]> = {
  REQUESTED: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['RETURN_REQUESTED', 'CANCELLED'],
  RETURN_REQUESTED: ['COMPLETED', 'CANCELLED'],
}

// ─── GET /api/v1/leave-of-absence/[id] ──────────────────

export const GET = withPermission(
  async (_req: NextRequest, context: RouteContext, user: SessionUser) => {
    const { id } = await context.params

    const record = await prisma.leaveOfAbsence.findFirst({
      where: { id, companyId: user.companyId, deletedAt: null },
      include: {
        employee: { select: { id: true, name: true, nameEn: true, employeeNo: true } },
        type: true,
        approver: { select: { id: true, name: true } },
        rejecter: { select: { id: true, name: true } },
        parent: { select: { id: true, startDate: true, actualEndDate: true, splitSequence: true } },
        splits: {
          select: { id: true, startDate: true, expectedEndDate: true, status: true, splitSequence: true },
          orderBy: { splitSequence: 'asc' },
        },
      },
    })
    if (!record) throw notFound('휴직 기록을 찾을 수 없습니다.')

    return apiSuccess(record)
  },
  perm(MODULE.LEAVE, ACTION.VIEW),
)

// ─── PATCH /api/v1/leave-of-absence/[id] ─────────────────
// action: 'approve' | 'reject' | 'activate' | 'return' | 'complete' | 'cancel'

export const PATCH = withPermission(
  async (req: NextRequest, context: RouteContext, user: SessionUser) => {
    try {
      const { id } = await context.params
      const body = (await req.json()) as Record<string, unknown>
      const { action } = body

      if (!action || typeof action !== 'string')
        throw badRequest('action은 필수입니다.')

      const record = await prisma.leaveOfAbsence.findFirst({
        where: { id, companyId: user.companyId, deletedAt: null },
        include: { type: true },
      })
      if (!record) throw notFound('휴직 기록을 찾을 수 없습니다.')

      switch (action) {
        case 'approve':
          return apiSuccess(await handleApprove(id, record, user))
        case 'reject':
          return apiSuccess(await handleReject(id, record, user, body))
        case 'activate':
          return apiSuccess(await handleActivate(id, record, user))
        case 'return':
          return apiSuccess(await handleReturn(id, record, body))
        case 'complete':
          return apiSuccess(await handleComplete(id, record, body, user))
        case 'cancel':
          return apiSuccess(await handleCancel(id, record))
        default:
          throw badRequest(`유효하지 않은 action: ${action}`)
      }
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.LEAVE, ACTION.UPDATE),
)

// ─── 상태 전이 핸들러 ──────────────────────────────────

function assertTransition(current: string, target: string) {
  const allowed = VALID_TRANSITIONS[current]
  if (!allowed || !allowed.includes(target)) {
    throw badRequest(`${current} 상태에서 ${target}(으)로 전이할 수 없습니다.`)
  }
}

type RecordWithType = Awaited<ReturnType<typeof prisma.leaveOfAbsence.findFirst>> & {
  type: NonNullable<Awaited<ReturnType<typeof prisma.leaveOfAbsenceType.findFirst>>>
}

// 승인
async function handleApprove(id: string, record: RecordWithType, user: SessionUser) {
  assertTransition(record.status, 'APPROVED')

  return prisma.leaveOfAbsence.update({
    where: { id },
    data: {
      status: 'APPROVED',
      approvedById: user.employeeId,
      approvedAt: new Date(),
    },
    include: {
      employee: { select: { id: true, name: true, employeeNo: true } },
      type: { select: { id: true, code: true, name: true } },
    },
  })
}

// 거부
async function handleReject(
  id: string,
  record: RecordWithType,
  user: SessionUser,
  body: Record<string, unknown>,
) {
  assertTransition(record.status, 'REJECTED')

  const rejectionReason = body.rejectionReason ? String(body.rejectionReason) : null
  if (!rejectionReason) throw badRequest('거부 사유는 필수입니다.')

  return prisma.leaveOfAbsence.update({
    where: { id },
    data: {
      status: 'REJECTED',
      rejectedBy: user.employeeId,
      rejectedAt: new Date(),
      rejectionReason,
    },
    include: {
      employee: { select: { id: true, name: true, employeeNo: true } },
      type: { select: { id: true, code: true, name: true } },
    },
  })
}

// 활성화 (APPROVED → ACTIVE) — EmployeeAssignment 연동 + PayrollAdjustment 생성
async function handleActivate(id: string, record: RecordWithType, user: SessionUser) {
  assertTransition(record.status, 'ACTIVE')

  // 트랜잭션: LOA 상태 변경 + 현재 assignment 종료 + ON_LEAVE assignment 생성
  const result = await prisma.$transaction(async (tx) => {
    // 현재 primary assignment 찾기
    const currentAssignment = await tx.employeeAssignment.findFirst({
      where: {
        employeeId: record.employeeId,
        isPrimary: true,
        endDate: null,
      },
      orderBy: { effectiveDate: 'desc' },
    })

    let loaAssignmentId: string | null = null

    if (currentAssignment) {
      // 현재 assignment 종료 (startDate 전일)
      const endDate = new Date(record.startDate)
      endDate.setDate(endDate.getDate() - 1)

      await tx.employeeAssignment.update({
        where: { id: currentAssignment.id },
        data: { endDate },
      })

      // ON_LEAVE assignment 생성
      const loaAssignment = await tx.employeeAssignment.create({
        data: {
          employeeId: record.employeeId,
          companyId: record.companyId,
          effectiveDate: record.startDate,
          changeType: 'STATUS_CHANGE',
          status: 'ON_LEAVE',
          isPrimary: true,
          employmentType: currentAssignment.employmentType,
          departmentId: currentAssignment.departmentId,
          jobGradeId: currentAssignment.jobGradeId,
          jobCategoryId: currentAssignment.jobCategoryId,
          positionId: currentAssignment.positionId,
          titleId: currentAssignment.titleId,
          workLocationId: currentAssignment.workLocationId,
          reason: `휴직: ${record.type.name}`,
        },
      })
      loaAssignmentId = loaAssignment.id
    }

    // LOA 상태 업데이트
    return tx.leaveOfAbsence.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        loaAssignmentId,
      },
      include: {
        employee: { select: { id: true, name: true, employeeNo: true } },
        type: { select: { id: true, code: true, name: true } },
      },
    })
  })

  // Side-effect: 월별 급여 조정 생성 (fire-and-forget)
  createCrossMonthLoaAdjustments(record, user.employeeId ?? user.id).catch((err) => {
    console.error('[LOA Phase 3] 급여 조정 생성 실패:', err)
  })

  // Side-effect: HR Admin 알림 발송
  notifyLoaActivation(record)

  return result
}

// HR Admin에 휴직 활성화 알림 발송
function notifyLoaActivation(record: RecordWithType) {
  // 해당 법인 HR Admin에게 알림 — fire-and-forget
  prisma.employee.findMany({
    where: {
      deletedAt: null,
      employeeRoles: { some: { role: { code: 'HR_ADMIN' } } },
      assignments: { some: { companyId: record.companyId, isPrimary: true, endDate: null } },
    },
    select: { id: true },
  }).then((hrAdmins) => {
    const payType = record.payType ?? record.type.payType ?? 'UNPAID'
    const payRate = record.payRate ?? record.type.payRate
    for (const hr of hrAdmins) {
      sendNotification({
        employeeId: hr.id,
        triggerType: 'LOA_ACTIVATED',
        title: '휴직 활성화 알림',
        body: `${record.type.name} 휴직이 시작되었습니다 (${payType}${payRate ? `, ${payRate}%` : ''})`,
        priority: 'normal',
        link: '/leave-of-absence',
      })
    }
  }).catch(() => {})
}

// 복직 신청 (ACTIVE → RETURN_REQUESTED)
// notes → returnNotes에 저장 (expectedEndDate는 절대 수정하지 않음)
async function handleReturn(
  id: string,
  record: RecordWithType,
  body: Record<string, unknown>,
) {
  assertTransition(record.status, 'RETURN_REQUESTED')

  const returnNotes = body.notes ? String(body.notes) : null

  return prisma.leaveOfAbsence.update({
    where: { id },
    data: {
      status: 'RETURN_REQUESTED',
      ...(returnNotes ? { returnNotes } : {}),
    },
    include: {
      employee: { select: { id: true, name: true, employeeNo: true } },
      type: { select: { id: true, code: true, name: true } },
    },
  })
}

// 복직 완료 (RETURN_REQUESTED → COMPLETED) — EmployeeAssignment 연동
async function handleComplete(
  id: string,
  record: RecordWithType,
  body: Record<string, unknown>,
  user: SessionUser,
) {
  assertTransition(record.status, 'COMPLETED')

  const actualEndDate = body.actualEndDate
    ? new Date(body.actualEndDate as string)
    : new Date()
  const returnPositionId = body.returnPositionId
    ? String(body.returnPositionId)
    : null
  const returnNotes = body.returnNotes ? String(body.returnNotes) : null

  return prisma.$transaction(async (tx) => {
    // ON_LEAVE assignment 종료
    if (record.loaAssignmentId) {
      await tx.employeeAssignment.update({
        where: { id: record.loaAssignmentId },
        data: { endDate: actualEndDate },
      })
    }

    // 복직 assignment 생성 — 원래 assignment의 정보 복원
    const loaAssignment = record.loaAssignmentId
      ? await tx.employeeAssignment.findUnique({ where: { id: record.loaAssignmentId } })
      : null

    let returnAssignmentId: string | null = null

    if (loaAssignment) {
      const nextDay = new Date(actualEndDate)
      nextDay.setDate(nextDay.getDate() + 1)

      const returnAssignment = await tx.employeeAssignment.create({
        data: {
          employeeId: record.employeeId,
          companyId: record.companyId,
          effectiveDate: nextDay,
          changeType: 'STATUS_CHANGE',
          status: 'ACTIVE',
          isPrimary: true,
          employmentType: loaAssignment.employmentType,
          departmentId: loaAssignment.departmentId,
          jobGradeId: loaAssignment.jobGradeId,
          jobCategoryId: loaAssignment.jobCategoryId,
          positionId: returnPositionId ?? loaAssignment.positionId,
          titleId: loaAssignment.titleId,
          workLocationId: loaAssignment.workLocationId,
          reason: `복직: ${record.type.name}`,
        },
      })
      returnAssignmentId = returnAssignment.id
    }

    // 급여 조정 소급 정산 (실제 종료일 기준)
    await reconcileLoaAdjustments(tx, record, actualEndDate, user.employeeId ?? user.id)

    return tx.leaveOfAbsence.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        actualEndDate,
        returnPositionId,
        returnNotes,
        returnAssignmentId,
      },
      include: {
        employee: { select: { id: true, name: true, employeeNo: true } },
        type: { select: { id: true, code: true, name: true } },
      },
    })
  })
}

// 취소
async function handleCancel(id: string, record: RecordWithType) {
  const allowed = VALID_TRANSITIONS[record.status]
  if (!allowed || !allowed.includes('CANCELLED')) {
    throw badRequest(`${record.status} 상태에서는 취소할 수 없습니다.`)
  }

  // ACTIVE 상태에서 취소 시 assignment 롤백
  if (record.status === 'ACTIVE' && record.loaAssignmentId) {
    return prisma.$transaction(async (tx) => {
      // ON_LEAVE assignment 종료
      await tx.employeeAssignment.update({
        where: { id: record.loaAssignmentId! },
        data: { endDate: new Date() },
      })

      // ACTIVE assignment 복원
      const loaAssignment = await tx.employeeAssignment.findUnique({
        where: { id: record.loaAssignmentId! },
      })

      if (loaAssignment) {
        await tx.employeeAssignment.create({
          data: {
            employeeId: record.employeeId,
            companyId: record.companyId,
            effectiveDate: new Date(),
            changeType: 'STATUS_CHANGE',
            status: 'ACTIVE',
            isPrimary: true,
            employmentType: loaAssignment.employmentType,
            departmentId: loaAssignment.departmentId,
            jobGradeId: loaAssignment.jobGradeId,
            jobCategoryId: loaAssignment.jobCategoryId,
            positionId: loaAssignment.positionId,
            titleId: loaAssignment.titleId,
            workLocationId: loaAssignment.workLocationId,
            reason: `휴직 취소: ${record.type.name}`,
          },
        })
      }

      return tx.leaveOfAbsence.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          actualEndDate: new Date(),
        },
        include: {
          employee: { select: { id: true, name: true, employeeNo: true } },
          type: { select: { id: true, code: true, name: true } },
        },
      })
    })
  }

  return prisma.leaveOfAbsence.update({
    where: { id },
    data: { status: 'CANCELLED' },
    include: {
      employee: { select: { id: true, name: true, employeeNo: true } },
      type: { select: { id: true, code: true, name: true } },
    },
  })
}
