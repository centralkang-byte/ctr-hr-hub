import 'server-only'

import { z } from 'zod'
import type { EmployeeAssignment, PayrollRun, Prisma } from '@/generated/prisma/client'
import {
  acquireExclusivePeriodLock,
  acquirePayrollRunRegistryLock,
  lockPayrollRunForUpdate,
  type PeriodLockHooks,
} from '@/lib/attendance/period-lock'
import {
  PRIMARY_ASSIGNMENT_RETRY_CODE,
  acquirePrimaryAssignmentDepartmentLocks,
  acquirePrimaryAssignmentEmployeeLocks,
  assertPrimaryAssignmentReplacement,
  assertPrimaryAssignmentSourceScopeLocked,
  casPrimaryAssignment,
  getPrimaryAssignmentAtDate,
  readPrimaryAssignmentTimeline,
  revalidatePrimaryAssignmentDepartments,
  revalidatePrimaryAssignmentMasterDataSet,
  withPrimaryAssignmentRetry,
  type PrimaryAssignmentMasterData,
  type PrimaryAssignmentLockHooks,
} from '@/lib/employee/primary-assignment-writer'
import { AppError, badRequest, conflict, forbidden, notFound } from '@/lib/errors'
import {
  buildLoaDesiredAmounts,
  generateLoaMonthlyRanges,
  getUnconsumedDeferredLoaObligationsForLoa,
  reconcileLockedLoaPayroll,
  type LoaPayrollDeferredWarning,
} from '@/lib/loa/payroll-adjustment'
import { prisma } from '@/lib/prisma'
import type { PrismaTx } from '@/lib/prisma-rls'
import { getTodayForTimezone } from '@/lib/assignments'
import { parseDateOnly } from '@/lib/timezone'

const TRANSACTION_TIMEOUT_MS = 60_000
const YEAR_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/, '날짜는 YYYY-MM-DD 형식이어야 합니다.')
  .refine((value) => {
    const parsed = parseDateOnly(value)
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
  }, '유효한 날짜가 아닙니다.')

const optionalNote = z.string().trim().min(1).max(2000).optional()

export const loaTransitionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve') }).strict(),
  z
    .object({
      action: z.literal('reject'),
      rejectionReason: z.string().trim().min(1).max(2000),
    })
    .strict(),
  z.object({ action: z.literal('activate') }).strict(),
  z.object({ action: z.literal('return'), notes: optionalNote }).strict(),
  z
    .object({
      action: z.literal('complete'),
      actualEndDate: dateOnlySchema,
      returnPositionId: z.string().trim().min(1).optional(),
      returnNotes: optionalNote,
    })
    .strict(),
  z.object({ action: z.literal('cancel') }).strict(),
])

export type LoaTransitionInput = z.infer<typeof loaTransitionSchema>

export function parseLoaTransitionInput(input: unknown): LoaTransitionInput {
  const parsed = loaTransitionSchema.safeParse(input)
  if (!parsed.success) {
    throw badRequest(parsed.error.issues[0]?.message ?? '잘못된 휴직 상태 전이 요청입니다.')
  }
  return parsed.data
}

const transitionInclude = {
  employee: { select: { id: true, name: true, employeeNo: true } },
  type: true,
} satisfies Prisma.LeaveOfAbsenceInclude

type LockedLoaRecord = Prisma.LeaveOfAbsenceGetPayload<{
  include: { type: true }
}>
type LoaTransitionRecord = Prisma.LeaveOfAbsenceGetPayload<{
  include: typeof transitionInclude
}>

interface LoaCandidate {
  id: string
  companyId: string
  employeeId: string
  status: string
  startDate: Date
  expectedEndDate: Date | null
}

export interface LoaTransitionAccess {
  isOwner: boolean
  isCompanyHr: boolean
  isGlobalSuper: boolean
}

export function isLoaTransitionAllowed(
  status: string,
  action: LoaTransitionInput['action'],
  access: LoaTransitionAccess,
): boolean {
  const isPrivileged = access.isCompanyHr || access.isGlobalSuper
  switch (action) {
    case 'approve':
    case 'reject':
    case 'activate':
    case 'complete':
      return isPrivileged
    case 'return':
      return access.isOwner || isPrivileged
    case 'cancel':
      return status === 'ACTIVE' || status === 'RETURN_REQUESTED'
        ? isPrivileged
        : access.isOwner || isPrivileged
  }
}

async function assertLoaTransitionAccess(
  client: PrismaTx,
  candidate: Pick<LoaCandidate, 'companyId' | 'employeeId' | 'status'>,
  actorId: string,
  action: LoaTransitionInput['action'],
): Promise<void> {
  const now = new Date()
  const actor = await client.employee.findFirst({
    where: { id: actorId, deletedAt: null },
    select: {
      assignments: {
        where: {
          isPrimary: true,
          endDate: null,
          effectiveDate: { lte: now },
          status: { in: ['ACTIVE', 'ON_LEAVE'] },
        },
        select: { companyId: true },
      },
      employeeRoles: {
        where: {
          startDate: { lte: now },
          endDate: null,
          OR: [
            { companyId: candidate.companyId, role: { code: 'HR_ADMIN' } },
            { role: { code: 'SUPER_ADMIN' } },
          ],
        },
        select: { companyId: true, role: { select: { code: true } } },
      },
    },
  })

  const hasCurrentAssignment = Boolean(actor?.assignments.length)
  const hasCurrentCompanyAssignment = Boolean(
    actor?.assignments.some((assignment) => assignment.companyId === candidate.companyId),
  )
  const access: LoaTransitionAccess = {
    isOwner: candidate.employeeId === actorId && hasCurrentCompanyAssignment,
    isCompanyHr:
      hasCurrentCompanyAssignment &&
      Boolean(
        actor?.employeeRoles.some(
          (employeeRole) =>
            employeeRole.companyId === candidate.companyId &&
            employeeRole.role.code === 'HR_ADMIN',
        ),
      ),
    isGlobalSuper:
      hasCurrentAssignment &&
      Boolean(
        actor?.employeeRoles.some(
          (employeeRole) => employeeRole.role.code === 'SUPER_ADMIN',
        ),
      ),
  }

  if (!isLoaTransitionAllowed(candidate.status, action, access)) {
    throw forbidden('이 휴직 상태를 변경할 권한이 없습니다.')
  }
}

export type LoaTransitionResult = LoaTransitionRecord & {
  deferredWarnings: LoaPayrollDeferredWarning[]
}

export interface LoaTransitionDeps extends PeriodLockHooks, PrimaryAssignmentLockHooks {
  db?: typeof prisma
}

function yearMonth(date: Date): string {
  return date.toISOString().slice(0, 7)
}

function monthEnd(value: string): Date {
  if (!YEAR_MONTH_PATTERN.test(value)) throw badRequest('잘못된 급여 대상 월입니다.')
  const [year, month] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month, 0))
}

function nextDate(date: Date): Date {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + 1)
  return result
}

function sourceStatuses(action: LoaTransitionInput['action']): readonly string[] {
  switch (action) {
    case 'approve':
    case 'reject':
      return ['REQUESTED']
    case 'activate':
      return ['APPROVED']
    case 'return':
      return ['ACTIVE']
    case 'complete':
      return ['RETURN_REQUESTED']
    case 'cancel':
      return ['REQUESTED', 'APPROVED', 'ACTIVE', 'RETURN_REQUESTED']
  }
}

function targetStatus(action: LoaTransitionInput['action']): string {
  switch (action) {
    case 'approve': return 'APPROVED'
    case 'reject': return 'REJECTED'
    case 'activate': return 'ACTIVE'
    case 'return': return 'RETURN_REQUESTED'
    case 'complete': return 'COMPLETED'
    case 'cancel': return 'CANCELLED'
  }
}

function assertCandidateSource(candidate: LoaCandidate, input: LoaTransitionInput): void {
  if (!sourceStatuses(input.action).includes(candidate.status)) {
    throw badRequest(
      `${candidate.status} 상태에서 ${targetStatus(input.action)}(으)로 전이할 수 없습니다.`,
    )
  }
}

async function lockLoaRecord(
  tx: PrismaTx,
  candidate: LoaCandidate,
): Promise<LockedLoaRecord> {
  const locked = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM leave_of_absences
    WHERE id = ${candidate.id}
      AND company_id = ${candidate.companyId}
      AND deleted_at IS NULL
    FOR UPDATE
  `
  if (locked.length === 0) throw notFound('휴직 기록을 찾을 수 없습니다.')

  const record = await tx.leaveOfAbsence.findFirst({
    where: { id: candidate.id, companyId: candidate.companyId, deletedAt: null },
    include: { type: true },
  })
  if (!record) throw notFound('휴직 기록을 찾을 수 없습니다.')
  if (
    record.status !== candidate.status ||
    record.startDate.getTime() !== candidate.startDate.getTime() ||
    record.expectedEndDate?.getTime() !== candidate.expectedEndDate?.getTime()
  ) {
    throw conflict(`휴직 상태가 변경되었습니다. (현재: ${record.status})`)
  }
  return record
}

async function casStatus(
  tx: PrismaTx,
  record: LockedLoaRecord,
  status: string,
  data: Prisma.LeaveOfAbsenceUncheckedUpdateManyInput = {},
): Promise<void> {
  const updated = await tx.leaveOfAbsence.updateMany({
    where: {
      id: record.id,
      companyId: record.companyId,
      deletedAt: null,
      status: record.status,
    },
    data: { ...data, status },
  })
  if (updated.count !== 1) throw conflict('휴직 상태가 변경되었습니다.')
}

async function createTransitionAudit(
  tx: PrismaTx,
  params: {
    record: LockedLoaRecord
    actorId: string
    action: LoaTransitionInput['action']
    deferredWarnings: LoaPayrollDeferredWarning[]
  },
): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorId: params.actorId,
      action: `LEAVE_OF_ABSENCE_${params.action.toUpperCase()}`,
      resourceType: 'LeaveOfAbsence',
      resourceId: params.record.id,
      companyId: params.record.companyId,
      changes: {
        version: 1,
        fromStatus: params.record.status,
        toStatus: targetStatus(params.action),
        deferredWarnings: params.deferredWarnings,
      } as unknown as Prisma.InputJsonValue,
      sensitivityLevel: 'HIGH',
    },
  })
}

async function fetchTransitionResult(
  tx: PrismaTx,
  id: string,
  companyId: string,
  deferredWarnings: LoaPayrollDeferredWarning[],
): Promise<LoaTransitionResult> {
  const record = await tx.leaveOfAbsence.findFirstOrThrow({
    where: { id, companyId, deletedAt: null },
    include: transitionInclude,
  })
  return { ...record, deferredWarnings }
}

async function runSimpleTransition(params: {
  candidate: LoaCandidate
  input: LoaTransitionInput
  actorId: string
  deps?: LoaTransitionDeps
}): Promise<LoaTransitionResult> {
  const db = params.deps?.db ?? prisma
  return db.$transaction(
    async (tx) => {
      const record = await lockLoaRecord(tx, params.candidate)
      assertCandidateSource(params.candidate, params.input)
      await assertLoaTransitionAccess(tx, record, params.actorId, params.input.action)

      switch (params.input.action) {
        case 'approve':
          await casStatus(tx, record, 'APPROVED', {
            approvedById: params.actorId,
            approvedAt: new Date(),
          })
          break
        case 'reject':
          await casStatus(tx, record, 'REJECTED', {
            rejectedBy: params.actorId,
            rejectedAt: new Date(),
            rejectionReason: params.input.rejectionReason,
          })
          break
        case 'return':
          await casStatus(tx, record, 'RETURN_REQUESTED', {
            ...(params.input.notes ? { returnNotes: params.input.notes } : {}),
          })
          break
        default:
          throw badRequest(`처리할 수 없는 휴직 상태 전이입니다: ${params.input.action}`)
      }

      await createTransitionAudit(tx, {
        record,
        actorId: params.actorId,
        action: params.input.action,
        deferredWarnings: [],
      })
      return fetchTransitionResult(tx, record.id, record.companyId, [])
    },
    { timeout: TRANSACTION_TIMEOUT_MS },
  )
}

type AssignmentMasterSnapshot = Pick<
  EmployeeAssignment,
  | 'id'
  | 'companyId'
  | 'departmentId'
  | 'jobGradeId'
  | 'titleId'
  | 'jobCategoryId'
  | 'positionId'
  | 'workLocationId'
>

function assignmentMasterData(
  template: AssignmentMasterSnapshot,
  positionId: string | null = template.positionId,
): PrimaryAssignmentMasterData {
  return {
    companyId: template.companyId,
    jobGradeId: template.jobGradeId,
    titleId: template.titleId,
    jobCategoryId: template.jobCategoryId,
    positionId,
    workLocationId: template.workLocationId,
  }
}

function matchesAssignmentMasterSnapshot(
  current: EmployeeAssignment,
  expected: AssignmentMasterSnapshot,
): boolean {
  return current.id === expected.id &&
    current.companyId === expected.companyId &&
    current.departmentId === expected.departmentId &&
    current.jobGradeId === expected.jobGradeId &&
    current.titleId === expected.titleId &&
    current.jobCategoryId === expected.jobCategoryId &&
    current.positionId === expected.positionId &&
    current.workLocationId === expected.workLocationId
}

function assertValidatedAssignmentTemplate(
  current: EmployeeAssignment,
  expected: AssignmentMasterSnapshot | null,
): void {
  if (expected && matchesAssignmentMasterSnapshot(current, expected)) return
  throw new AppError(
    409,
    PRIMARY_ASSIGNMENT_RETRY_CODE,
    '휴직 발령의 소속 또는 기준정보가 변경되었습니다. 전체 작업을 다시 시도합니다.',
    { employeeId: current.employeeId, assignmentId: current.id },
  )
}

function assignmentData(template: EmployeeAssignment) {
  return {
    employmentType: template.employmentType,
    contractType: template.contractType,
    departmentId: template.departmentId,
    jobGradeId: template.jobGradeId,
    jobCategoryId: template.jobCategoryId,
    positionId: template.positionId,
    titleId: template.titleId,
    workLocationId: template.workLocationId,
  }
}

async function activateAssignment(
  tx: PrismaTx,
  record: LockedLoaRecord,
  timeline: readonly EmployeeAssignment[],
  expectedTemplate: AssignmentMasterSnapshot | null,
): Promise<string> {
  const template = getPrimaryAssignmentAtDate(timeline, record.startDate)
  if (!template) throw badRequest('활성화할 현재 주 발령 정보를 찾을 수 없습니다.')
  assertValidatedAssignmentTemplate(template, expectedTemplate)
  if (template.companyId !== record.companyId) {
    throw conflict('휴직 시작일의 주 발령 법인이 휴직 법인과 다릅니다.')
  }
  if (template.effectiveDate.getTime() >= record.startDate.getTime()) {
    throw conflict('휴직 시작일에 다른 주 발령이 이미 예정되어 있습니다.')
  }
  if (template.status !== 'ACTIVE') {
    throw conflict('휴직 시작일의 주 발령이 활성 상태가 아닙니다.')
  }

  assertPrimaryAssignmentReplacement({
    timeline,
    replacedAssignmentId: template.id,
    closeDate: record.startDate,
    nextEffectiveDate: record.startDate,
    nextEndDate: null,
  })
  await casPrimaryAssignment(tx, template, { endDate: record.startDate })

  const assignment = await tx.employeeAssignment.create({
    data: {
      employeeId: record.employeeId,
      companyId: record.companyId,
      effectiveDate: record.startDate,
      changeType: 'STATUS_CHANGE',
      status: 'ON_LEAVE',
      isPrimary: true,
      ...assignmentData(template),
      reason: `휴직: ${record.type.name}`,
    },
  })
  await tx.leaveOfAbsence.update({
    where: { id: record.id },
    data: { loaAssignmentId: assignment.id },
  })
  return assignment.id
}

async function restoreAssignment(
  tx: PrismaTx,
  params: {
    record: LockedLoaRecord
    timeline: readonly EmployeeAssignment[]
    effectiveDate: Date
    closeDate: Date
    positionId: string | null
    reason: string
    expectedTemplate: AssignmentMasterSnapshot | null
  },
): Promise<string> {
  const explicitTemplate = params.record.loaAssignmentId
    ? params.timeline.find(
      (assignment) => assignment.id === params.record.loaAssignmentId,
    ) ?? null
    : null
  const currentAssignment = getPrimaryAssignmentAtDate(
    params.timeline,
    params.closeDate,
  )
  const template = explicitTemplate ?? currentAssignment
  if (!template) throw badRequest('복원할 휴직 발령 정보를 찾을 수 없습니다.')
  assertValidatedAssignmentTemplate(template, params.expectedTemplate)
  if (template.companyId !== params.record.companyId) {
    throw conflict('복원할 휴직 발령 법인이 휴직 법인과 다릅니다.')
  }

  if (currentAssignment && currentAssignment.id !== template.id) {
    throw conflict('복직일에 다른 주 발령이 이미 유효합니다.')
  }

  if (template.status !== 'ON_LEAVE') {
    throw conflict('복원할 휴직 발령이 휴직 상태가 아닙니다.')
  }

  assertPrimaryAssignmentReplacement({
    timeline: params.timeline,
    replacedAssignmentId: template.id,
    closeDate: params.closeDate,
    nextEffectiveDate: params.effectiveDate,
    nextEndDate: null,
  })
  await casPrimaryAssignment(tx, template, { endDate: params.closeDate })

  const restored = await tx.employeeAssignment.create({
    data: {
      employeeId: params.record.employeeId,
      companyId: params.record.companyId,
      effectiveDate: params.effectiveDate,
      changeType: 'STATUS_CHANGE',
      status: 'ACTIVE',
      isPrimary: true,
      ...assignmentData(template),
      positionId: params.positionId ?? template.positionId,
      reason: params.reason,
    },
  })
  await tx.leaveOfAbsence.update({
    where: { id: params.record.id },
    data: { returnAssignmentId: restored.id },
  })
  return restored.id
}

function writesPrimaryAssignment(
  record: LockedLoaRecord,
  input: Extract<LoaTransitionInput, { action: 'activate' | 'complete' | 'cancel' }>,
): boolean {
  return input.action === 'activate' ||
    input.action === 'complete' ||
    record.status === 'ACTIVE' ||
    record.status === 'RETURN_REQUESTED'
}

async function findAssignmentTemplateHint(
  tx: PrismaTx,
  record: LockedLoaRecord,
  input: Extract<LoaTransitionInput, { action: 'activate' | 'complete' | 'cancel' }>,
): Promise<EmployeeAssignment | null> {
  if (!writesPrimaryAssignment(record, input)) return null

  if (input.action === 'activate') {
    return tx.employeeAssignment.findFirst({
      where: {
        employeeId: record.employeeId,
        companyId: record.companyId,
        isPrimary: true,
        effectiveDate: { lte: record.startDate },
        OR: [{ endDate: null }, { endDate: { gt: record.startDate } }],
      },
      orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    })
  }

  if (record.loaAssignmentId) {
    return tx.employeeAssignment.findFirst({
      where: {
        id: record.loaAssignmentId,
        employeeId: record.employeeId,
        companyId: record.companyId,
        isPrimary: true,
      },
    })
  }

  return tx.employeeAssignment.findFirst({
    where: {
      employeeId: record.employeeId,
      companyId: record.companyId,
      isPrimary: true,
      status: 'ON_LEAVE',
      endDate: null,
    },
    orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
  })
}

function sourceMonthsForCandidate(params: {
  candidate: LoaCandidate
  input: Extract<LoaTransitionInput, { action: 'activate' | 'complete' | 'cancel' }>
  latestExistingMonth: string | null
  extraSourceMonths: readonly string[]
}): string[] {
  const { candidate, input } = params
  let endDate: Date
  if (input.action === 'complete') {
    const actualEndDate = parseDateOnly(input.actualEndDate)
    endDate = candidate.expectedEndDate && candidate.expectedEndDate > actualEndDate
      ? candidate.expectedEndDate
      : actualEndDate
  } else if (candidate.expectedEndDate) {
    endDate = candidate.expectedEndDate
  } else {
    endDate = params.latestExistingMonth
      ? monthEnd(params.latestExistingMonth)
      : candidate.startDate
  }
  const rangeMonths = generateLoaMonthlyRanges(candidate.startDate, endDate).map(
    (value) => value.yearMonth,
  )
  return [...new Set([...rangeMonths, ...params.extraSourceMonths])].sort()
}

async function runPayrollTransition(params: {
  candidate: LoaCandidate
  input: Extract<LoaTransitionInput, { action: 'activate' | 'complete' | 'cancel' }>
  actorId: string
  deps?: LoaTransitionDeps
}): Promise<LoaTransitionResult> {
  const db = params.deps?.db ?? prisma
  return withPrimaryAssignmentRetry(
    () => db.$transaction(
      async (tx) => {
      await acquirePayrollRunRegistryLock(tx, {
        companyId: params.candidate.companyId,
        operation: `loa-${params.input.action}`,
        deps: params.deps,
      })

      const [adjustmentRefs, obligations] = await Promise.all([
        tx.payrollAdjustment.findMany({
          where: { loaId: params.candidate.id },
          select: {
            loaYearMonth: true,
            payrollRun: {
              select: { id: true, companyId: true, yearMonth: true, runType: true },
            },
          },
        }),
        getUnconsumedDeferredLoaObligationsForLoa(
          tx,
          params.candidate.companyId,
          params.candidate.id,
        ),
      ])
      if (
        adjustmentRefs.some(
          (value) => value.payrollRun.companyId !== params.candidate.companyId,
        )
      ) {
        throw conflict('휴직 급여 조정의 법인 범위가 일치하지 않습니다.')
      }

      const extraSourceMonths = [
        ...adjustmentRefs.flatMap((value) =>
          value.loaYearMonth ? [value.loaYearMonth] : [],
        ),
        ...obligations.map((value) => value.sourceYearMonth),
      ]
      const earliestMonth = [yearMonth(params.candidate.startDate), ...extraSourceMonths]
        .sort()[0]
      const monthlyRunCandidates = await tx.payrollRun.findMany({
        where: {
          companyId: params.candidate.companyId,
          runType: 'MONTHLY',
          yearMonth: { gte: earliestMonth },
        },
        select: { id: true, companyId: true, yearMonth: true, runType: true },
        orderBy: [{ yearMonth: 'asc' }, { id: 'asc' }],
      })
      const latestExistingMonth = monthlyRunCandidates.at(-1)?.yearMonth ?? null
      const sourceMonths = sourceMonthsForCandidate({
        candidate: params.candidate,
        input: params.input,
        latestExistingMonth,
        extraSourceMonths,
      })

      const runCandidates = new Map<string, {
        id: string
        companyId: string
        yearMonth: string
        runType: PayrollRun['runType']
      }>()
      for (const run of monthlyRunCandidates) runCandidates.set(run.id, run)
      for (const reference of adjustmentRefs) {
        runCandidates.set(reference.payrollRun.id, reference.payrollRun)
      }
      const periodMonths = [...new Set([
        ...sourceMonths,
        ...[...runCandidates.values()].map((value) => value.yearMonth),
      ])].sort()
      for (const periodMonth of periodMonths) {
        await acquireExclusivePeriodLock(tx, {
          companyId: params.candidate.companyId,
          yearMonth: periodMonth,
          operation: `loa-${params.input.action}`,
          deps: params.deps,
        })
      }

      const record = await lockLoaRecord(tx, params.candidate)
      assertCandidateSource(params.candidate, params.input)
      await assertLoaTransitionAccess(tx, record, params.actorId, params.input.action)
      if (record.expectedEndDate && record.expectedEndDate < record.startDate) {
        throw badRequest('예정 복직일은 휴직 시작일보다 빠를 수 없습니다.')
      }
      const lockedRuns: PayrollRun[] = []
      for (const runCandidate of [...runCandidates.values()].sort((a, b) =>
        a.yearMonth.localeCompare(b.yearMonth) || a.id.localeCompare(b.id),
      )) {
        const run = await lockPayrollRunForUpdate(tx, {
          companyId: params.candidate.companyId,
          runId: runCandidate.id,
          operation: `loa-${params.input.action}`,
          deps: params.deps,
        })
        if (!run) throw conflict('휴직 급여 실행이 변경되었습니다.')
        if (
          run.yearMonth !== runCandidate.yearMonth ||
          run.runType !== runCandidate.runType
        ) {
          throw conflict('휴직 급여 실행의 대상 월 또는 유형이 변경되었습니다.')
        }
        lockedRuns.push(run)
      }

      const expectedAssignmentTemplate = await findAssignmentTemplateHint(
        tx,
        record,
        params.input,
      )
      const lockedDepartmentKeys = new Set(
        await acquirePrimaryAssignmentDepartmentLocks(
          tx,
          expectedAssignmentTemplate
            ? [{
              companyId: expectedAssignmentTemplate.companyId,
              departmentId: expectedAssignmentTemplate.departmentId,
            }]
            : [],
          params.deps,
        ),
      )
      if (expectedAssignmentTemplate) {
        assertPrimaryAssignmentSourceScopeLocked(
          lockedDepartmentKeys,
          expectedAssignmentTemplate,
        )
        await revalidatePrimaryAssignmentDepartments(
          tx,
          [expectedAssignmentTemplate],
        )
      }
      await revalidatePrimaryAssignmentMasterDataSet(
        tx,
        expectedAssignmentTemplate
          ? [assignmentMasterData(
            expectedAssignmentTemplate,
            params.input.action === 'complete'
              ? params.input.returnPositionId ?? expectedAssignmentTemplate.positionId
              : expectedAssignmentTemplate.positionId,
          )]
          : [{ companyId: record.companyId }],
      )

      const company = await tx.company.findFirst({
        where: { id: record.companyId, deletedAt: null },
        select: { timezone: true },
      })
      if (!company) throw notFound('법인 정보를 찾을 수 없습니다.')
      const localToday = getTodayForTimezone(company.timezone)

      await acquirePrimaryAssignmentEmployeeLocks(
        tx,
        [record.employeeId],
        params.deps,
      )
      const assignmentTimeline = await readPrimaryAssignmentTimeline(
        tx,
        record.employeeId,
        params.deps,
      )
      let desiredAmounts = new Map<string, number>()
      let reconciliationKey: string = params.input.action

      if (params.input.action === 'activate') {
        const endDate = record.expectedEndDate
          ?? (latestExistingMonth ? monthEnd(latestExistingMonth) : record.startDate)
        desiredAmounts = await buildLoaDesiredAmounts(tx, record, endDate)
        await casStatus(tx, record, 'ACTIVE')
        await activateAssignment(
          tx,
          record,
          assignmentTimeline,
          expectedAssignmentTemplate,
        )
      } else if (params.input.action === 'complete') {
        const actualEndDate = parseDateOnly(params.input.actualEndDate)
        if (actualEndDate < record.startDate) {
          throw badRequest('실제 복직일은 휴직 시작일보다 빠를 수 없습니다.')
        }
        if (actualEndDate > localToday) {
          throw badRequest('실제 복직일은 법인 현지 오늘 이후일 수 없습니다.')
        }
        if (params.input.returnPositionId) {
          const position = await tx.position.findFirst({
            where: {
              id: params.input.returnPositionId,
              companyId: record.companyId,
              deletedAt: null,
            },
            select: { id: true },
          })
          if (!position) throw badRequest('유효한 동일 법인 복귀 직위를 선택해야 합니다.')
        }
        desiredAmounts = await buildLoaDesiredAmounts(tx, record, actualEndDate)
        reconciliationKey = `complete:${params.input.actualEndDate}`
        await casStatus(tx, record, 'COMPLETED', {
          actualEndDate,
          returnPositionId: params.input.returnPositionId ?? null,
          returnNotes: params.input.returnNotes ?? null,
        })
        const returnDate = nextDate(actualEndDate)
        await restoreAssignment(tx, {
          record,
          timeline: assignmentTimeline,
          closeDate: returnDate,
          effectiveDate: returnDate,
          positionId: params.input.returnPositionId ?? null,
          reason: `복직: ${record.type.name}`,
          expectedTemplate: expectedAssignmentTemplate,
        })
      } else {
        reconciliationKey = 'cancel'
        const restoresAssignment =
          record.status === 'ACTIVE' || record.status === 'RETURN_REQUESTED'
        await casStatus(tx, record, 'CANCELLED', {
          ...(restoresAssignment ? { actualEndDate: localToday } : {}),
        })
        if (restoresAssignment) {
          await restoreAssignment(tx, {
            record,
            timeline: assignmentTimeline,
            closeDate: localToday,
            effectiveDate: localToday,
            positionId: null,
            reason: `휴직 취소: ${record.type.name}`,
            expectedTemplate: expectedAssignmentTemplate,
          })
        }
      }

      const deferredWarnings = await reconcileLockedLoaPayroll(tx, {
        record,
        actorId: params.actorId,
        sourceYearMonths: sourceMonths,
        desiredAmounts,
        lockedRuns,
        reconciliationKey,
        createZeroBaseRows: params.input.action === 'activate',
      })
      await createTransitionAudit(tx, {
        record,
        actorId: params.actorId,
        action: params.input.action,
        deferredWarnings,
      })
        return fetchTransitionResult(tx, record.id, record.companyId, deferredWarnings)
      },
      { timeout: TRANSACTION_TIMEOUT_MS },
    ),
    { deps: params.deps },
  )
}

export async function transitionLeaveOfAbsence(params: {
  id: string
  companyId: string
  actorId: string
  input: LoaTransitionInput
  deps?: LoaTransitionDeps
}): Promise<LoaTransitionResult> {
  const db = params.deps?.db ?? prisma
  const candidate = await db.leaveOfAbsence.findFirst({
    where: { id: params.id, companyId: params.companyId, deletedAt: null },
    select: {
      id: true,
      companyId: true,
      employeeId: true,
      status: true,
      startDate: true,
      expectedEndDate: true,
    },
  })
  if (!candidate) throw notFound('휴직 기록을 찾을 수 없습니다.')
  assertCandidateSource(candidate, params.input)
  await assertLoaTransitionAccess(db, candidate, params.actorId, params.input.action)

  if (
    params.input.action === 'activate' ||
    params.input.action === 'complete' ||
    params.input.action === 'cancel'
  ) {
    return runPayrollTransition({
      candidate,
      input: params.input,
      actorId: params.actorId,
      deps: params.deps,
    })
  }
  return runSimpleTransition({
    candidate,
    input: params.input,
    actorId: params.actorId,
    deps: params.deps,
  })
}
