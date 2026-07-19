import 'server-only'

import type { Prisma } from '@/generated/prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { AppError, notFound } from '@/lib/errors'
import type { SessionUser } from '@/types'
import {
  ATTENDANCE_CORRECTION_ERROR_CODES,
  attendanceCorrectionDetailsV1Schema,
  buildAttendanceCorrectionBefore,
  buildAttendanceCorrectionDetails,
  deriveAttendanceCorrectionValues,
  isAttendanceCorrectionContextCurrent,
  isAttendanceSnapshotCurrent,
  validateAttendanceCorrection,
} from '@/lib/attendance/correction'
import {
  acquireSharedPeriodLock,
  assertAttendancePeriodEditable,
  lockAttendanceForUpdate,
  yearMonthFromWorkDate,
  type PeriodLockHooks,
} from '@/lib/attendance/period-lock'
import { resolveEffectiveAttendanceSettings } from '@/lib/attendance/timezone-resolver'
import {
  judgeStatusForAttendance,
  resolveEffectiveSchedule,
} from '@/lib/attendance/judgeStatus'
import {
  findCorrectionApproverIds,
  getCorrectionReviewerScope,
} from '@/lib/attendance/correction-roles'
import { computeOvertimeMinutes } from '@/lib/attendance/overtime'

const CORRECTION_TRANSACTION_TIMEOUT_MS = 60_000

export interface CorrectionRequestMeta {
  ip?: string
  userAgent?: string
}

export interface CorrectionServiceDeps extends PeriodLockHooks {
  db?: typeof prisma
  now?: () => Date
  afterCandidateRead?: (context: {
    operation: string
    attendanceId: string
  }) => Promise<void>
}

const directCorrectionSchema = z.object({
  clockIn: z.string().datetime().nullable().optional(),
  clockOut: z.string().datetime().nullable().optional(),
  workType: z.enum(['NORMAL', 'OVERTIME', 'NIGHT', 'HOLIDAY']).optional(),
  status: z.enum(['NORMAL', 'LATE', 'EARLY_OUT', 'ABSENT']).optional(),
  note: z.string().min(1).max(500),
})

function invalidCorrection(issue: string, field?: string): AppError {
  return new AppError(
    400,
    ATTENDANCE_CORRECTION_ERROR_CODES.INVALID,
    '근태 보정 요청 값이 올바르지 않습니다.',
    { issue, ...(field ? { field } : {}) },
  )
}

export async function applyDirectAttendanceCorrection(params: {
  attendanceId: string
  input: unknown
  user: SessionUser
  meta?: CorrectionRequestMeta
  deps?: CorrectionServiceDeps
}) {
  const parsed = directCorrectionSchema.safeParse(params.input)
  if (!parsed.success) {
    throw invalidCorrection('invalid_body')
  }

  const db = params.deps?.db ?? prisma
  const now = params.deps?.now?.() ?? new Date()
  const candidate = await db.attendance.findUnique({
    where: { id: params.attendanceId },
    select: {
      id: true,
      companyId: true,
      employeeId: true,
      workDate: true,
      clockIn: true,
      clockOut: true,
      totalMinutes: true,
      overtimeMinutes: true,
      status: true,
      workType: true,
      note: true,
    },
  })
  if (!candidate) throw notFound('출근 기록을 찾을 수 없습니다.')

  const scope = await getCorrectionReviewerScope(db, params.user.employeeId, now)
  if (!scope.isGlobalSuper && !scope.hrCompanyIds.includes(candidate.companyId)) {
    throw notFound('출근 기록을 찾을 수 없습니다.')
  }

  const operation = 'attendance-direct-correction'
  const yearMonth = yearMonthFromWorkDate(candidate.workDate)
  const candidateSnapshot = {
    workDate: candidate.workDate.toISOString().slice(0, 10),
    before: buildAttendanceCorrectionBefore(candidate),
  }
  await params.deps?.afterCandidateRead?.({
    operation,
    attendanceId: candidate.id,
  })

  return db.$transaction(async (tx) => {
    await acquireSharedPeriodLock(tx, {
      companyId: candidate.companyId,
      yearMonth,
      operation,
      deps: params.deps,
    })
    const attendance = await lockAttendanceForUpdate(tx, {
      companyId: candidate.companyId,
      attendanceId: candidate.id,
      operation,
      deps: params.deps,
    })
    if (!attendance) throw notFound('출근 기록을 찾을 수 없습니다.')
    if (
      attendance.employeeId !== candidate.employeeId ||
      !isAttendanceSnapshotCurrent(attendance, candidateSnapshot)
    ) {
      throw new AppError(
        409,
        ATTENDANCE_CORRECTION_ERROR_CODES.STALE,
        '근태 기록이 변경되었습니다.',
      )
    }

    const currentScope = await getCorrectionReviewerScope(tx, params.user.employeeId, now)
    if (
      !currentScope.isGlobalSuper &&
      !currentScope.hrCompanyIds.includes(attendance.companyId)
    ) {
      throw notFound('출근 기록을 찾을 수 없습니다.')
    }

    await resolveEffectiveAttendanceSettings(tx, attendance.companyId)
    await assertAttendancePeriodEditable(tx, {
      companyId: attendance.companyId,
      yearMonth,
    })

    const updateData: Record<string, unknown> = { note: parsed.data.note }
    if (parsed.data.clockIn !== undefined) {
      updateData.clockIn = parsed.data.clockIn ? new Date(parsed.data.clockIn) : null
    }
    if (parsed.data.clockOut !== undefined) {
      updateData.clockOut = parsed.data.clockOut ? new Date(parsed.data.clockOut) : null
    }
    if (parsed.data.workType !== undefined) updateData.workType = parsed.data.workType
    if (parsed.data.status !== undefined) updateData.status = parsed.data.status

    const effectiveClockIn = parsed.data.clockIn === undefined
      ? attendance.clockIn
      : parsed.data.clockIn ? new Date(parsed.data.clockIn) : null
    const effectiveClockOut = parsed.data.clockOut === undefined
      ? attendance.clockOut
      : parsed.data.clockOut ? new Date(parsed.data.clockOut) : null
    if (effectiveClockIn && effectiveClockOut) {
      const totalMinutes = Math.max(
        0,
        Math.round((effectiveClockOut.getTime() - effectiveClockIn.getTime()) / 60_000),
      )
      updateData.totalMinutes = totalMinutes
      updateData.overtimeMinutes = computeOvertimeMinutes(totalMinutes)
    } else {
      updateData.totalMinutes = null
      updateData.overtimeMinutes = null
    }

    const timesChanged = parsed.data.clockIn !== undefined || parsed.data.clockOut !== undefined
    if (timesChanged && parsed.data.status === undefined) {
      updateData.status = await judgeStatusForAttendance({
        companyId: attendance.companyId,
        employeeId: attendance.employeeId,
        workDate: attendance.workDate,
        clockIn: effectiveClockIn,
        clockOut: effectiveClockOut,
        previousStatus: attendance.status,
      }, tx)
    }

    const updated = await tx.attendance.update({
      where: { id: attendance.id },
      data: updateData,
      include: { employee: { select: { name: true, employeeNo: true } } },
    })
    await tx.auditLog.create({
      data: {
        actorId: params.user.employeeId,
        action: 'attendance.manual_correction',
        resourceType: 'attendance',
        resourceId: attendance.id,
        companyId: attendance.companyId,
        changes: {
          before: {
            clockIn: attendance.clockIn,
            clockOut: attendance.clockOut,
            workType: attendance.workType,
            status: attendance.status,
            note: attendance.note,
          },
          after: parsed.data,
        },
        ipAddress: params.meta?.ip ?? null,
        userAgent: params.meta?.userAgent ?? null,
      },
    })
    return updated
  }, { timeout: CORRECTION_TRANSACTION_TIMEOUT_MS })
}

export async function createAttendanceCorrectionRequest(params: {
  attendanceId: string
  input: unknown
  user: SessionUser
  meta?: CorrectionRequestMeta
  deps?: CorrectionServiceDeps
}) {
  const db = params.deps?.db ?? prisma
  const candidate = await db.attendance.findFirst({
    where: {
      id: params.attendanceId,
      companyId: params.user.companyId,
      employeeId: params.user.employeeId,
    },
    select: { id: true, companyId: true, workDate: true },
  })
  if (!candidate) throw notFound('근태 기록을 찾을 수 없습니다.')

  const yearMonth = yearMonthFromWorkDate(candidate.workDate)
  const now = params.deps?.now?.() ?? new Date()

  return db.$transaction(async (tx) => {
    await acquireSharedPeriodLock(tx, {
      companyId: candidate.companyId,
      yearMonth,
      operation: 'attendance-correction-create',
      deps: params.deps,
    })
    const attendance = await lockAttendanceForUpdate(tx, {
      companyId: candidate.companyId,
      attendanceId: candidate.id,
      operation: 'attendance-correction-create',
      deps: params.deps,
    })
    if (
      !attendance ||
      attendance.employeeId !== params.user.employeeId ||
      attendance.companyId !== params.user.companyId
    ) {
      throw notFound('근태 기록을 찾을 수 없습니다.')
    }

    const settings = await resolveEffectiveAttendanceSettings(tx, attendance.companyId)
    const schedule = await resolveEffectiveSchedule(
      {
        companyId: attendance.companyId,
        employeeId: attendance.employeeId,
        workDate: attendance.workDate,
        baseStartHHmm: settings.workStartTime,
        baseEndHHmm: settings.workEndTime,
      },
      tx,
    )
    const validated = validateAttendanceCorrection({
      requested: params.input,
      before: attendance,
      workDate: attendance.workDate.toISOString().slice(0, 10),
      timezone: settings.timezone,
      schedule,
      now,
    })
    if (!validated.ok) throw invalidCorrection(validated.issue, validated.field)

    await assertAttendancePeriodEditable(tx, {
      companyId: attendance.companyId,
      yearMonth,
    })
    const duplicate = await tx.attendanceApprovalRequest.findFirst({
      where: {
        companyId: attendance.companyId,
        requesterId: params.user.employeeId,
        requestType: 'attendance_correction',
        referenceId: attendance.id,
        status: 'pending',
      },
      select: { id: true },
    })
    if (duplicate) {
      throw new AppError(
        409,
        ATTENDANCE_CORRECTION_ERROR_CODES.DUPLICATE,
        '이미 처리 중인 근태 보정 요청이 있습니다.',
      )
    }

    const approverIds = await findCorrectionApproverIds(
      tx,
      attendance.companyId,
      params.user.employeeId,
      now,
    )
    if (approverIds.length === 0) {
      throw new AppError(409, 'ATTENDANCE_CORRECTION_NO_APPROVER', '승인 가능한 HR 담당자가 없습니다.')
    }

    const details = buildAttendanceCorrectionDetails({
      workDate: attendance.workDate,
      timezone: settings.timezone,
      schedule,
      reason: validated.requested.reason,
      before: attendance,
      requested: { clockIn: validated.clockIn, clockOut: validated.clockOut },
    })
    const created = await tx.attendanceApprovalRequest.create({
      data: {
        companyId: attendance.companyId,
        requesterId: params.user.employeeId,
        requestType: 'attendance_correction',
        referenceId: attendance.id,
        title: `근태 보정 요청 ${details.workDate}`,
        details: details as unknown as Prisma.InputJsonValue,
        status: 'pending',
        currentStep: 1,
      },
    })
    await tx.attendanceApprovalStep.createMany({
      data: approverIds.map((approverId) => ({
        requestId: created.id,
        stepOrder: 1,
        approverId,
        status: 'pending',
      })),
    })
    await tx.auditLog.create({
      data: {
        actorId: params.user.employeeId,
        action: 'ATTENDANCE_CORRECTION_REQUEST_CREATE',
        resourceType: 'AttendanceApprovalRequest',
        resourceId: created.id,
        companyId: attendance.companyId,
        changes: details as unknown as Prisma.InputJsonValue,
        ipAddress: params.meta?.ip ?? null,
        userAgent: params.meta?.userAgent ?? null,
      },
    })

    return tx.attendanceApprovalRequest.findUniqueOrThrow({
      where: { id: created.id },
      include: {
        steps: {
          include: { approver: { select: { id: true, name: true } } },
          orderBy: [{ stepOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        },
      },
    })
  }, { timeout: CORRECTION_TRANSACTION_TIMEOUT_MS })
}

export async function decideAttendanceCorrectionRequest(params: {
  requestId: string
  action: 'approve' | 'reject'
  comment?: string
  user: SessionUser
  meta?: CorrectionRequestMeta
  deps?: CorrectionServiceDeps
}) {
  const db = params.deps?.db ?? prisma
  const candidate = await db.attendanceApprovalRequest.findFirst({
    where: {
      id: params.requestId,
      requestType: 'attendance_correction',
      requesterId: { not: params.user.employeeId },
      steps: {
        some: {
          approverId: params.user.employeeId,
          status: 'pending',
        },
      },
    },
    select: { id: true, companyId: true, referenceId: true },
  })
  if (!candidate) throw notFound('근태 보정 요청을 찾을 수 없습니다.')

  if (params.action === 'reject') {
    const now = params.deps?.now?.() ?? new Date()
    return db.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM attendance_approval_requests
        WHERE id = ${candidate.id}
        FOR UPDATE
      `
      const request = await tx.attendanceApprovalRequest.findUnique({
        where: { id: candidate.id },
        include: {
          steps: { orderBy: [{ stepOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }] },
        },
      })
      if (!request || request.requestType !== 'attendance_correction') {
        throw notFound('근태 보정 요청을 찾을 수 없습니다.')
      }
      if (request.status !== 'pending') {
        throw new AppError(
          409,
          ATTENDANCE_CORRECTION_ERROR_CODES.DECISION_RACE,
          '이미 처리된 근태 보정 요청입니다.',
        )
      }
      const scope = await getCorrectionReviewerScope(tx, params.user.employeeId, now)
      const canReview = scope.isGlobalSuper || scope.hrCompanyIds.includes(request.companyId)
      const actingStep = request.steps.find(
        (step) => step.approverId === params.user.employeeId && step.status === 'pending',
      )
      if (!canReview || request.requesterId === params.user.employeeId || !actingStep) {
        throw notFound('근태 보정 요청을 찾을 수 없습니다.')
      }

      const changed = await tx.attendanceApprovalRequest.updateMany({
        where: { id: request.id, status: 'pending' },
        data: { status: 'rejected' },
      })
      if (changed.count !== 1) {
        throw new AppError(409, ATTENDANCE_CORRECTION_ERROR_CODES.DECISION_RACE, '이미 처리된 요청입니다.')
      }
      await tx.attendanceApprovalStep.update({
        where: { id: actingStep.id },
        data: { status: 'rejected', comment: params.comment, decidedAt: now },
      })
      await tx.attendanceApprovalStep.updateMany({
        where: { requestId: request.id, id: { not: actingStep.id }, status: 'pending' },
        data: { status: 'skipped' },
      })
      await tx.auditLog.create({
        data: {
          actorId: params.user.employeeId,
          action: 'ATTENDANCE_CORRECTION_REJECT',
          resourceType: 'AttendanceApprovalRequest',
          resourceId: request.id,
          companyId: request.companyId,
          changes: { comment: params.comment ?? null },
          ipAddress: params.meta?.ip ?? null,
          userAgent: params.meta?.userAgent ?? null,
        },
      })
      return tx.attendanceApprovalRequest.findUniqueOrThrow({
        where: { id: request.id },
        include: {
          steps: { orderBy: [{ stepOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }] },
        },
      })
    }, { timeout: CORRECTION_TRANSACTION_TIMEOUT_MS })
  }

  if (!candidate.referenceId) throw invalidCorrection('invalid_body', 'referenceId')
  const attendanceCandidate = await db.attendance.findFirst({
    where: { id: candidate.referenceId, companyId: candidate.companyId },
    select: { id: true, companyId: true, workDate: true },
  })
  if (!attendanceCandidate) throw invalidCorrection('invalid_body', 'referenceId')
  const yearMonth = yearMonthFromWorkDate(attendanceCandidate.workDate)
  const now = params.deps?.now?.() ?? new Date()

  return db.$transaction(async (tx) => {
    await acquireSharedPeriodLock(tx, {
      companyId: attendanceCandidate.companyId,
      yearMonth,
      operation: 'attendance-correction-approve',
      deps: params.deps,
    })
    const attendance = await lockAttendanceForUpdate(tx, {
      companyId: attendanceCandidate.companyId,
      attendanceId: attendanceCandidate.id,
      operation: 'attendance-correction-approve',
      deps: params.deps,
    })
    if (!attendance) throw invalidCorrection('invalid_body', 'referenceId')

    const settings = await resolveEffectiveAttendanceSettings(tx, attendance.companyId)
    const schedule = await resolveEffectiveSchedule(
      {
        companyId: attendance.companyId,
        employeeId: attendance.employeeId,
        workDate: attendance.workDate,
        baseStartHHmm: settings.workStartTime,
        baseEndHHmm: settings.workEndTime,
      },
      tx,
    )
    await tx.$queryRaw`
      SELECT id FROM attendance_approval_requests
      WHERE id = ${candidate.id}
      FOR UPDATE
    `
    const request = await tx.attendanceApprovalRequest.findUnique({
      where: { id: candidate.id },
      include: {
        steps: { orderBy: [{ stepOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }] },
      },
    })
    if (!request || request.requestType !== 'attendance_correction') {
      throw notFound('근태 보정 요청을 찾을 수 없습니다.')
    }
    if (request.status !== 'pending') {
      throw new AppError(409, ATTENDANCE_CORRECTION_ERROR_CODES.DECISION_RACE, '이미 처리된 요청입니다.')
    }

    const detailsResult = attendanceCorrectionDetailsV1Schema.safeParse(request.details)
    if (!detailsResult.success || request.referenceId !== attendance.id) {
      throw invalidCorrection('invalid_body', 'details')
    }
    const details = detailsResult.data
    const scope = await getCorrectionReviewerScope(tx, params.user.employeeId, now)
    const canReview = scope.isGlobalSuper || scope.hrCompanyIds.includes(request.companyId)
    const actingStep = request.steps.find(
      (step) => step.approverId === params.user.employeeId && step.status === 'pending',
    )
    if (!canReview || request.requesterId === params.user.employeeId || !actingStep) {
      throw notFound('근태 보정 요청을 찾을 수 없습니다.')
    }
    if (
      request.companyId !== attendance.companyId ||
      request.requesterId !== attendance.employeeId ||
      !isAttendanceSnapshotCurrent(attendance, details)
    ) {
      throw new AppError(409, ATTENDANCE_CORRECTION_ERROR_CODES.STALE, '근태 기록이 변경되었습니다.')
    }
    if (!isAttendanceCorrectionContextCurrent(details, { timezone: settings.timezone, schedule })) {
      throw new AppError(409, ATTENDANCE_CORRECTION_ERROR_CODES.STALE, '근태 설정이 변경되었습니다.')
    }
    const validated = validateAttendanceCorrection({
      requested: { ...details.requested, reason: details.reason },
      before: details.before,
      workDate: details.workDate,
      timezone: settings.timezone,
      schedule,
      now,
    })
    if (!validated.ok) throw invalidCorrection(validated.issue, validated.field)
    await assertAttendancePeriodEditable(tx, { companyId: attendance.companyId, yearMonth })

    const derived = deriveAttendanceCorrectionValues({
      clockIn: validated.clockIn,
      clockOut: validated.clockOut,
      scheduledStart: validated.window.scheduledStart,
      scheduledEnd: validated.window.scheduledEnd,
    })
    const requestChanged = await tx.attendanceApprovalRequest.updateMany({
      where: { id: request.id, status: 'pending' },
      data: { status: 'approved' },
    })
    if (requestChanged.count !== 1) {
      throw new AppError(409, ATTENDANCE_CORRECTION_ERROR_CODES.DECISION_RACE, '이미 처리된 요청입니다.')
    }
    const attendanceChanged = await tx.attendance.updateMany({
      where: {
        id: attendance.id,
        companyId: attendance.companyId,
        employeeId: attendance.employeeId,
        workDate: attendance.workDate,
        clockIn: details.before.clockIn ? new Date(details.before.clockIn) : null,
        clockOut: details.before.clockOut ? new Date(details.before.clockOut) : null,
        totalMinutes: details.before.totalMinutes,
        overtimeMinutes: details.before.overtimeMinutes,
        status: details.before.status,
        workType: details.before.workType,
        note: details.before.note,
      },
      data: {
        clockIn: validated.clockIn,
        clockOut: validated.clockOut,
        totalMinutes: derived.totalMinutes,
        overtimeMinutes: derived.overtimeMinutes,
        status: derived.status,
      },
    })
    if (attendanceChanged.count !== 1) {
      throw new AppError(409, ATTENDANCE_CORRECTION_ERROR_CODES.STALE, '근태 기록이 변경되었습니다.')
    }
    await tx.attendanceApprovalStep.update({
      where: { id: actingStep.id },
      data: { status: 'approved', comment: params.comment, decidedAt: now },
    })
    await tx.attendanceApprovalStep.updateMany({
      where: { requestId: request.id, id: { not: actingStep.id }, status: 'pending' },
      data: { status: 'skipped' },
    })
    await tx.auditLog.create({
      data: {
        actorId: params.user.employeeId,
        action: 'ATTENDANCE_CORRECTION_APPROVE',
        resourceType: 'Attendance',
        resourceId: attendance.id,
        companyId: attendance.companyId,
        changes: {
          requestId: request.id,
          before: details.before,
          requested: details.requested,
          derived,
        } as unknown as Prisma.InputJsonValue,
        ipAddress: params.meta?.ip ?? null,
        userAgent: params.meta?.userAgent ?? null,
      },
    })
    return tx.attendanceApprovalRequest.findUniqueOrThrow({
      where: { id: request.id },
      include: {
        steps: { orderBy: [{ stepOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }] },
      },
    })
  }, { timeout: CORRECTION_TRANSACTION_TIMEOUT_MS })
}

export async function claimAttendanceCorrectionRequest(params: {
  requestId: string
  user: SessionUser
  meta?: CorrectionRequestMeta
  deps?: CorrectionServiceDeps
}) {
  const db = params.deps?.db ?? prisma
  const now = params.deps?.now?.() ?? new Date()
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT id FROM attendance_approval_requests
      WHERE id = ${params.requestId} AND request_type = 'attendance_correction'
      FOR UPDATE
    `
    const request = await tx.attendanceApprovalRequest.findFirst({
      where: { id: params.requestId, requestType: 'attendance_correction' },
      include: {
        steps: { orderBy: [{ stepOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }] },
      },
    })
    if (!request) throw notFound('근태 보정 요청을 찾을 수 없습니다.')
    if (request.status !== 'pending') {
      throw new AppError(409, ATTENDANCE_CORRECTION_ERROR_CODES.DECISION_RACE, '이미 처리된 요청입니다.')
    }
    const scope = await getCorrectionReviewerScope(tx, params.user.employeeId, now)
    const canReview = scope.isGlobalSuper || scope.hrCompanyIds.includes(request.companyId)
    if (!canReview || request.requesterId === params.user.employeeId) {
      throw notFound('근태 보정 요청을 찾을 수 없습니다.')
    }

    const actorSteps = request.steps.filter((step) => step.approverId === params.user.employeeId)
    if (!actorSteps.some((step) => step.status === 'pending')) {
      const waiting = actorSteps.find((step) => step.status === 'waiting')
      if (waiting) {
        await tx.attendanceApprovalStep.update({
          where: { id: waiting.id },
          data: { status: 'pending', stepOrder: request.currentStep },
        })
      } else {
        await tx.attendanceApprovalStep.create({
          data: {
            requestId: request.id,
            stepOrder: request.currentStep,
            approverId: params.user.employeeId,
            status: 'pending',
          },
        })
      }
      await tx.auditLog.create({
        data: {
          actorId: params.user.employeeId,
          action: 'ATTENDANCE_CORRECTION_CLAIM',
          resourceType: 'AttendanceApprovalRequest',
          resourceId: request.id,
          companyId: request.companyId,
          ipAddress: params.meta?.ip ?? null,
          userAgent: params.meta?.userAgent ?? null,
        },
      })
    }
    return tx.attendanceApprovalRequest.findUniqueOrThrow({
      where: { id: request.id },
      include: {
        steps: { orderBy: [{ stepOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }] },
      },
    })
  }, { timeout: CORRECTION_TRANSACTION_TIMEOUT_MS })
}
