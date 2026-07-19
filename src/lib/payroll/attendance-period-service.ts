import 'server-only'

import { prisma } from '@/lib/prisma'
import { AppError, badRequest, conflict, notFound } from '@/lib/errors'
import {
  acquireExclusivePeriodLock,
  acquirePayrollRunRegistryLock,
  lockPayrollRunForUpdate,
  type PeriodLockHooks,
} from '@/lib/attendance/period-lock'
import { createPayrollRunWithInitialLoaChildrenLocked } from '@/lib/payroll/run-service'
import { consumeDeferredLoaObligationsForRun } from '@/lib/loa/payroll-adjustment'

const REOPENABLE_STATUSES = ['ATTENDANCE_CLOSED', 'ADJUSTMENT', 'REVIEW'] as const
const ATTENDANCE_PERIOD_TRANSACTION_TIMEOUT_MS = 60_000

export interface AttendancePeriodServiceDeps extends PeriodLockHooks {
  db?: typeof prisma
}

export async function closeAttendancePeriod(params: {
  companyId: string
  year: number
  month: number
  excludeEmployeeIds: string[]
  actorId: string
  ip?: string
  userAgent?: string
  deps?: AttendancePeriodServiceDeps
}) {
  const yearMonth = `${params.year}-${String(params.month).padStart(2, '0')}`
  const periodStart = new Date(Date.UTC(params.year, params.month - 1, 1))
  const periodEndExclusive = new Date(Date.UTC(params.year, params.month, 1))
  const periodEnd = new Date(Date.UTC(params.year, params.month, 0))

  const db = params.deps?.db ?? prisma
  return db.$transaction(async (tx) => {
    await acquirePayrollRunRegistryLock(tx, {
      companyId: params.companyId,
      operation: 'payroll-attendance-close',
      deps: params.deps,
    })
    await acquireExclusivePeriodLock(tx, {
      companyId: params.companyId,
      yearMonth,
      operation: 'payroll-attendance-close',
      deps: params.deps,
    })
    const company = await tx.company.findFirst({
      where: { id: params.companyId, deletedAt: null },
      select: { name: true },
    })
    if (!company) throw badRequest('존재하지 않는 법인입니다.')

    let run = await tx.payrollRun.findUnique({
      where: {
        companyId_yearMonth_runType: {
          companyId: params.companyId,
          yearMonth,
          runType: 'MONTHLY',
        },
      },
    })
    if (run) {
      run = await lockPayrollRunForUpdate(tx, {
        companyId: params.companyId,
        runId: run.id,
        operation: 'payroll-attendance-close',
        deps: params.deps,
      })
      if (!run) throw notFound('급여 실행을 찾을 수 없습니다.')
    }
    if (run && run.status !== 'DRAFT') {
      throw conflict(`${yearMonth} 급여 실행이 이미 ${run.status} 상태입니다. 마감 불가.`)
    }

    const [pendingCorrection] = await tx.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM attendance_approval_requests request
        JOIN attendances attendance
          ON attendance.id::text = request.reference_id
         AND attendance.company_id = request.company_id
        WHERE request.company_id = ${params.companyId}
          AND request.request_type = 'attendance_correction'
          AND request.status = 'pending'
          AND attendance.work_date >= ${periodStart}
          AND attendance.work_date < ${periodEndExclusive}
      ) AS exists
    `
    if (pendingCorrection?.exists) {
      throw new AppError(
        409,
        'ATTENDANCE_CORRECTION_PENDING',
        '처리 중인 근태 보정 요청이 있어 마감할 수 없습니다.',
      )
    }

    const [totalEmployees, confirmedRows] = await Promise.all([
      tx.employee.count({
        where: {
          deletedAt: null,
          assignments: {
            some: {
              companyId: params.companyId,
              isPrimary: true,
              status: 'ACTIVE',
              effectiveDate: { lte: periodEnd },
              OR: [{ endDate: null }, { endDate: { gt: periodStart } }],
            },
          },
        },
      }),
      tx.attendance.findMany({
        where: {
          companyId: params.companyId,
          workDate: { gte: periodStart, lt: periodEndExclusive },
          clockOut: { not: null },
        },
        select: { employeeId: true },
        distinct: ['employeeId'],
      }),
    ])

    if (!run) {
      run = await createPayrollRunWithInitialLoaChildrenLocked(tx, {
        companyId: params.companyId,
        actorId: params.actorId,
        yearMonth,
        year: params.year,
        month: params.month,
        runType: 'MONTHLY',
        name: `${yearMonth} 월급 (${company.name})`,
        excludedEmployeeIds: params.excludeEmployeeIds,
        periodStart,
        periodEnd,
      })
    }
    const transition = await tx.payrollRun.updateMany({
      where: { id: run.id, companyId: params.companyId, status: 'DRAFT' },
      data: {
        status: 'ATTENDANCE_CLOSED',
        attendanceClosedAt: new Date(),
        attendanceClosedBy: params.actorId,
        excludedEmployeeIds: params.excludeEmployeeIds,
      },
    })
    if (transition.count !== 1) throw conflict('급여 실행 상태가 변경되었습니다.')

    await tx.auditLog.create({
      data: {
        actorId: params.actorId,
        action: 'PAYROLL_ATTENDANCE_CLOSE',
        resourceType: 'PayrollRun',
        resourceId: run.id,
        companyId: params.companyId,
        changes: { yearMonth, totalEmployees, confirmedCount: confirmedRows.length },
        ipAddress: params.ip ?? null,
        userAgent: params.userAgent ?? null,
      },
    })
    const updated = await tx.payrollRun.findUniqueOrThrow({ where: { id: run.id } })
    return {
      payrollRun: updated,
      summary: {
        totalEmployees,
        confirmedCount: confirmedRows.length,
        unconfirmedCount: totalEmployees - confirmedRows.length,
        excludedCount: params.excludeEmployeeIds.length,
      },
    }
  }, { timeout: ATTENDANCE_PERIOD_TRANSACTION_TIMEOUT_MS })
}

export async function reopenAttendancePeriod(params: {
  payrollRunId: string
  companyId: string
  actorId: string
  reason?: string
  ip?: string
  userAgent?: string
  deps?: AttendancePeriodServiceDeps
}) {
  const db = params.deps?.db ?? prisma
  const candidate = await db.payrollRun.findFirst({
    where: { id: params.payrollRunId, companyId: params.companyId },
    select: { id: true, companyId: true, yearMonth: true },
  })
  if (!candidate) throw notFound('급여 실행을 찾을 수 없습니다.')

  return db.$transaction(async (tx) => {
    await acquirePayrollRunRegistryLock(tx, {
      companyId: candidate.companyId,
      operation: 'payroll-attendance-reopen',
      deps: params.deps,
    })
    await acquireExclusivePeriodLock(tx, {
      companyId: candidate.companyId,
      yearMonth: candidate.yearMonth,
      operation: 'payroll-attendance-reopen',
      deps: params.deps,
    })
    const run = await lockPayrollRunForUpdate(tx, {
      companyId: candidate.companyId,
      runId: candidate.id,
      operation: 'payroll-attendance-reopen',
      deps: params.deps,
    })
    if (!run) throw notFound('급여 실행을 찾을 수 없습니다.')
    if (!REOPENABLE_STATUSES.includes(run.status as (typeof REOPENABLE_STATUSES)[number])) {
      throw badRequest(
        `${REOPENABLE_STATUSES.join(' | ')} 상태에서만 마감 해제가 가능합니다. (현재: ${run.status})`,
      )
    }
    const previousStatus = run.status

    if (previousStatus === 'ADJUSTMENT' || previousStatus === 'REVIEW') {
      await tx.payrollAnomaly.deleteMany({ where: { payrollRunId: run.id } })
      await tx.payrollItem.deleteMany({ where: { runId: run.id } })
    }
    if (previousStatus === 'REVIEW') {
      await tx.payrollApproval.deleteMany({ where: { payrollRunId: run.id } })
    }
    await consumeDeferredLoaObligationsForRun(tx, {
      run,
      actorId: params.actorId,
      projectedStatus: 'DRAFT',
      projectedAttendanceClosedAt: null,
    })
    const transition = await tx.payrollRun.updateMany({
      where: { id: run.id, companyId: run.companyId, status: previousStatus },
      data: {
        status: 'DRAFT',
        attendanceClosedAt: null,
        attendanceClosedBy: null,
        excludedEmployeeIds: [],
        totalGross: null,
        totalDeductions: null,
        totalNet: null,
        headcount: 0,
        anomalyCount: 0,
        allAnomaliesResolved: false,
      },
    })
    if (transition.count !== 1) throw conflict('급여 실행 상태가 변경되었습니다.')

    await tx.auditLog.create({
      data: {
        actorId: params.actorId,
        action: 'PAYROLL_ATTENDANCE_REOPEN',
        resourceType: 'PayrollRun',
        resourceId: run.id,
        companyId: run.companyId,
        changes: { yearMonth: run.yearMonth, previousStatus, reason: params.reason ?? null },
        ipAddress: params.ip ?? null,
        userAgent: params.userAgent ?? null,
      },
    })
    return {
      payrollRun: await tx.payrollRun.findUniqueOrThrow({ where: { id: run.id } }),
      previousStatus,
    }
  }, { timeout: ATTENDANCE_PERIOD_TRANSACTION_TIMEOUT_MS })
}
