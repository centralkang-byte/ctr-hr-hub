// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Unified Attendance Approval Action API (B6-2)
// GET    /api/v1/approvals/attendance/[id]  — 상세 조회
// PUT    /api/v1/approvals/attendance/[id]  — 승인/반려 처리
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, conflict, notFound, forbidden } from '@/lib/errors'
import { hasPermission, withAuth, perm, requirePermission } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { z } from 'zod'
import type { SessionUser } from '@/types'
import { getCorrectionReviewerScope } from '@/lib/attendance/correction-roles'
import {
  claimAttendanceCorrectionRequest,
  decideAttendanceCorrectionRequest,
} from '@/lib/attendance/correction-service'
import { extractRequestMeta } from '@/lib/audit'
import {
  attendanceCorrectionDetailsV1Schema,
  isAttendanceCorrectionContextCurrent,
  isAttendanceSnapshotCurrent,
} from '@/lib/attendance/correction'
import { resolveEffectiveAttendanceSettings } from '@/lib/attendance/timezone-resolver'
import { resolveEffectiveSchedule } from '@/lib/attendance/judgeStatus'
import {
  isAttendancePeriodEditable,
  yearMonthFromWorkDate,
} from '@/lib/attendance/period-lock'

const actionSchema = z.object({
  action: z.enum(['approve', 'reject', 'claim']),
  comment: z.string().max(500).optional(),
}).strict()

function permissionForRequestType(requestType: string, action: string) {
  if (requestType === 'leave') return perm(MODULE.LEAVE, action)
  if (['overtime', 'attendance_correction', 'shift_change'].includes(requestType)) {
    return perm(MODULE.ATTENDANCE, action)
  }
  throw badRequest('지원하지 않는 승인 요청 유형입니다.')
}

export const GET = withAuth(
  async (_req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params
    const canReadLeave = hasPermission(user, perm(MODULE.LEAVE, ACTION.VIEW))
    const canReadAttendance = hasPermission(user, perm(MODULE.ATTENDANCE, ACTION.VIEW))
    const allowedTypes = [
      ...(canReadLeave ? ['leave'] : []),
      ...(canReadAttendance ? ['overtime', 'attendance_correction', 'shift_change'] : []),
    ]
    if (allowedTypes.length === 0) {
      throw forbidden('승인 요청을 조회할 권한이 없습니다.')
    }
    const scope = await getCorrectionReviewerScope(prisma, user.employeeId)
    const correctionReviewer = !canReadAttendance
      ? []
      : scope.isGlobalSuper
      ? [{ requestType: 'attendance_correction' }]
      : scope.hrCompanyIds.length > 0
        ? [{
            requestType: 'attendance_correction',
            companyId: { in: scope.hrCompanyIds },
          }]
        : []
    const req = await prisma.attendanceApprovalRequest.findFirst({
      where: {
        id,
        requestType: { in: allowedTypes },
        OR: [
          { requestType: 'attendance_correction', requesterId: user.employeeId },
          ...correctionReviewer,
          {
            requestType: { not: 'attendance_correction' },
            requesterId: user.employeeId,
          },
          {
            requestType: { not: 'attendance_correction' },
            ...(scope.isGlobalSuper ? {} : { companyId: user.companyId }),
            steps: { some: { approverId: user.employeeId } },
          },
        ],
      },
      include: {
        requester: { select: { id: true, name: true, employeeNo: true } },
        steps: {
          include: { approver: { select: { id: true, name: true } } },
          orderBy: [{ stepOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        },
      },
    })
    if (!req) throw notFound('승인 요청을 찾을 수 없습니다.')
    requirePermission(user, permissionForRequestType(req.requestType, ACTION.VIEW))
    let correctionState: 'ready' | 'stale' | 'payroll_locked' | 'invalid' | undefined
    if (req.requestType === 'attendance_correction') {
      correctionState = 'invalid'
      const details = attendanceCorrectionDetailsV1Schema.safeParse(req.details)
      if (details.success && req.referenceId) {
        const attendance = await prisma.attendance.findFirst({
          where: { id: req.referenceId, companyId: req.companyId },
        })
        if (attendance && attendance.employeeId === req.requesterId) {
          const settings = await resolveEffectiveAttendanceSettings(prisma, attendance.companyId)
          const schedule = await resolveEffectiveSchedule({
            companyId: attendance.companyId,
            employeeId: attendance.employeeId,
            workDate: attendance.workDate,
            baseStartHHmm: settings.workStartTime,
            baseEndHHmm: settings.workEndTime,
          })
          if (
            !isAttendanceSnapshotCurrent(attendance, details.data) ||
            !isAttendanceCorrectionContextCurrent(details.data, {
              timezone: settings.timezone,
              schedule,
            })
          ) {
            correctionState = 'stale'
          } else {
            const run = await prisma.payrollRun.findUnique({
              where: {
                companyId_yearMonth_runType: {
                  companyId: attendance.companyId,
                  yearMonth: yearMonthFromWorkDate(attendance.workDate),
                  runType: 'MONTHLY',
                },
              },
              select: { id: true, runType: true, status: true, attendanceClosedAt: true },
            })
            correctionState = isAttendancePeriodEditable(run) ? 'ready' : 'payroll_locked'
          }
        }
      }
    }
    return apiSuccess({ ...req, ...(correctionState ? { correctionState } : {}) })
  },
)

export const PUT = withAuth(
  async (req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params
    let body: unknown
    try {
      body = await req.json()
    } catch {
      throw badRequest('요청 본문이 올바른 JSON 형식이 아닙니다.')
    }
    const parsed = actionSchema.safeParse(body)
    if (!parsed.success) throw badRequest(parsed.error.message)
    const { action, comment } = parsed.data

    const scope = await getCorrectionReviewerScope(prisma, user.employeeId)
    const canDecideLeave = hasPermission(user, perm(MODULE.LEAVE, ACTION.UPDATE))
    const canDecideAttendance = hasPermission(
      user,
      perm(MODULE.ATTENDANCE, ACTION.APPROVE),
    )
    const canReviewCorrections = scope.isGlobalSuper || scope.hrCompanyIds.length > 0
    if (!canDecideLeave && !canDecideAttendance && !canReviewCorrections) {
      throw forbidden('승인 요청을 처리할 권한이 없습니다.')
    }
    const correctionActor = !canReviewCorrections
      ? []
      : scope.isGlobalSuper
      ? [{ requestType: 'attendance_correction' }]
      : scope.hrCompanyIds.length > 0
        ? [{
            requestType: 'attendance_correction',
            companyId: { in: scope.hrCompanyIds },
          }]
        : []
    const approvalReq = await prisma.attendanceApprovalRequest.findFirst({
      where: {
        id,
        OR: [
          ...correctionActor,
          ...(canDecideLeave ? [{
            requestType: 'leave',
            ...(scope.isGlobalSuper ? {} : { companyId: user.companyId }),
            steps: { some: { approverId: user.employeeId } },
          }] : []),
          ...(canDecideAttendance ? [{
            requestType: { in: ['overtime', 'shift_change'] },
            ...(scope.isGlobalSuper ? {} : { companyId: user.companyId }),
            steps: { some: { approverId: user.employeeId } },
          }] : []),
        ],
      },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    })
    if (!approvalReq) throw notFound('승인 요청을 찾을 수 없습니다.')
    if (approvalReq.requestType === 'attendance_correction') {
      const meta = extractRequestMeta(req.headers)
      const updated = action === 'claim'
        ? await claimAttendanceCorrectionRequest({ requestId: id, user, meta })
        : await decideAttendanceCorrectionRequest({ requestId: id, action, comment, user, meta })
      return apiSuccess(updated)
    }
    if (action === 'claim') throw badRequest('근태 보정 요청만 claim할 수 있습니다.')
    requirePermission(
      user,
      permissionForRequestType(
        approvalReq.requestType,
        approvalReq.requestType === 'leave' ? ACTION.UPDATE : ACTION.APPROVE,
      ),
    )
    if (!scope.isGlobalSuper && approvalReq.companyId !== user.companyId) {
      throw notFound('승인 요청을 찾을 수 없습니다.')
    }
    if (approvalReq.status !== 'pending') throw badRequest('이미 처리된 요청입니다.')

    // 현재 단계 확인
    const currentStep = approvalReq.steps.find(
      (s) => s.stepOrder === approvalReq.currentStep && s.status === 'pending'
    )
    if (!currentStep) throw badRequest('현재 승인 단계를 찾을 수 없습니다.')
    if (currentStep.approverId !== user.employeeId) throw forbidden('이 요청의 승인자가 아닙니다.')

    const now = new Date()

    // 동시 결재 race 방어: pending→approved/rejected atomic transition. updateMany +
    // status: 'pending' 조건 → READ COMMITTED row lock으로 첫 tx만 count=1, 둘째는
    // count=0 → race lost. mixed approve/reject 동시 클릭 + double-click 시 nextStep
    // 중복 활성화 + currentStep 2번 advance 차단.
    const txResult = await prisma.$transaction(async (tx) => {
      const stepUpdate = await tx.attendanceApprovalStep.updateMany({
        where: { id: currentStep.id, status: 'pending' },
        data: {
          status: action === 'approve' ? 'approved' : 'rejected',
          comment,
          decidedAt: now,
        },
      })
      if (stepUpdate.count === 0) return { raceLost: true } as const

      if (action === 'reject') {
        // 반려 — 요청 최종 반려
        await tx.attendanceApprovalRequest.update({
          where: { id },
          data: { status: 'rejected', updatedAt: now },
        })
      } else {
        // 승인 — 다음 단계 확인
        const nextStep = approvalReq.steps.find((s) => s.stepOrder === approvalReq.currentStep + 1)
        if (nextStep) {
          // 다음 단계로 진행
          await tx.attendanceApprovalStep.update({
            where: { id: nextStep.id },
            data: { status: 'pending' },
          })
          await tx.attendanceApprovalRequest.update({
            where: { id },
            data: { currentStep: approvalReq.currentStep + 1, updatedAt: now },
          })
        } else {
          // 모든 단계 완료 — 최종 승인
          await tx.attendanceApprovalRequest.update({
            where: { id },
            data: { status: 'approved', updatedAt: now },
          })
        }
      }
      return { raceLost: false } as const
    })

    if (txResult.raceLost) throw conflict('이미 처리된 결재 단계입니다.')

    // 최신 상태 반환
    const updated = await prisma.attendanceApprovalRequest.findUnique({
      where: { id },
      include: {
        requester: { select: { id: true, name: true } },
        steps: {
          include: { approver: { select: { id: true, name: true } } },
          orderBy: { stepOrder: 'asc' },
        },
      },
    })
    return apiSuccess(updated)
  },
)
