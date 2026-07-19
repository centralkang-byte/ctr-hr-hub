// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Primary EmployeeAssignment write boundary
// Lock order: domain row -> department keys -> master-data rows -> employee keys
// -> fresh timeline. Master-data rows use canonical `type:id` order.
// ═══════════════════════════════════════════════════════════

import 'server-only'

import type { EmployeeAssignment } from '@/generated/prisma/client'
import { AppError, badRequest, conflict } from '@/lib/errors'
import type { PrismaTx } from '@/lib/prisma-rls'

const DEPARTMENT_LOCK_NAMESPACE = 'primary-assignment:department'
const EMPLOYEE_LOCK_NAMESPACE = 'primary-assignment:employee'
const NULL_DEPARTMENT_SENTINEL = '<null>'
const DEFAULT_RETRY_ATTEMPTS = 3

const PRIMARY_ASSIGNMENT_MASTER_DATA_FIELDS = [
  { type: 'jobGrade', field: 'jobGradeId' },
  { type: 'title', field: 'titleId' },
  { type: 'jobCategory', field: 'jobCategoryId' },
  { type: 'position', field: 'positionId' },
  { type: 'workLocation', field: 'workLocationId' },
] as const

type PrimaryAssignmentMasterDataType =
  | 'company'
  | (typeof PRIMARY_ASSIGNMENT_MASTER_DATA_FIELDS)[number]['type']

interface PrimaryAssignmentMasterDataLockTarget {
  type: PrimaryAssignmentMasterDataType
  id: string
  companyId: string
  key: string
}

const PRIMARY_ASSIGNMENT_MASTER_DATA_ERRORS: Record<
  PrimaryAssignmentMasterDataType,
  string
> = {
  company: 'companyId(법인)가 존재하지 않거나 삭제되었습니다.',
  jobGrade: 'jobGradeId(직급)가 해당 법인에 속하지 않거나 삭제되었습니다.',
  title: 'titleId(호칭)가 해당 법인에 속하지 않거나 삭제되었습니다.',
  jobCategory: 'jobCategoryId(직군)가 해당 법인에 속하지 않거나 삭제되었습니다.',
  position: 'positionId(직위)가 해당 법인에 속하지 않거나 삭제되었습니다.',
  workLocation: 'workLocationId(근무지)가 해당 법인에 속하지 않거나 삭제되었습니다.',
}

export const PRIMARY_ASSIGNMENT_RETRY_CODE = 'PRIMARY_ASSIGNMENT_RETRY_REQUIRED'

export interface PrimaryAssignmentDepartmentScope {
  companyId: string
  departmentId: string | null
}

export interface PrimaryAssignmentMasterData {
  companyId: string
  jobGradeId?: string | null
  titleId?: string | null
  jobCategoryId?: string | null
  positionId?: string | null
  workLocationId?: string | null
}

export interface PrimaryAssignmentLockHooks {
  afterPrimaryAssignmentDepartmentLock?: (context: {
    key: string
  }) => Promise<void>
  afterPrimaryAssignmentEmployeeLock?: (context: {
    employeeId: string
    key: string
  }) => Promise<void>
  afterPrimaryAssignmentTimelineRead?: (context: {
    employeeId: string
    assignmentIds: string[]
  }) => Promise<void>
  onPrimaryAssignmentRetry?: (context: {
    attempt: number
    error: unknown
  }) => Promise<void>
}

export type PrimaryAssignmentInterval = Pick<
  EmployeeAssignment,
  'id' | 'effectiveDate' | 'endDate'
>

type PrimaryAssignmentUpdateData = NonNullable<
  Parameters<PrismaTx['employeeAssignment']['updateMany']>[0]
>['data']

function requireNonEmpty(value: string, field: string): string {
  const normalized = value.trim()
  if (!normalized) throw badRequest(`${field} 값이 필요합니다.`)
  return normalized
}

function compareCanonicalKey(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function primaryAssignmentMasterDataLockTargets(
  dataSet: readonly PrimaryAssignmentMasterData[],
): PrimaryAssignmentMasterDataLockTarget[] {
  const byKey = new Map<string, PrimaryAssignmentMasterDataLockTarget>()

  for (const data of dataSet) {
    const companyId = requireNonEmpty(data.companyId, 'companyId')
    const companyKey = `company:${companyId}`
    byKey.set(companyKey, {
      type: 'company',
      id: companyId,
      companyId,
      key: companyKey,
    })

    for (const { type, field } of PRIMARY_ASSIGNMENT_MASTER_DATA_FIELDS) {
      const value = data[field]
      if (value === null || value === undefined) continue

      const id = requireNonEmpty(value, field)
      const key = `${type}:${id}`
      const existing = byKey.get(key)
      if (existing && existing.companyId !== companyId) {
        throw badRequest(`${field}가 서로 다른 법인에 중복 지정되었습니다.`)
      }
      byKey.set(key, { type, id, companyId, key })
    }
  }

  return [...byKey.values()].sort((left, right) =>
    compareCanonicalKey(left.key, right.key),
  )
}

async function lockPrimaryAssignmentMasterDataRow(
  tx: PrismaTx,
  target: PrimaryAssignmentMasterDataLockTarget,
): Promise<Array<{ id: string }>> {
  switch (target.type) {
    case 'company':
      return tx.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM companies
        WHERE id = ${target.id}
          AND deleted_at IS NULL
        FOR SHARE
      `
    case 'jobGrade':
      return tx.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM job_grades
        WHERE id = ${target.id}
          AND company_id = ${target.companyId}
          AND deleted_at IS NULL
        FOR SHARE
      `
    case 'title':
      return tx.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM employee_titles
        WHERE id = ${target.id}
          AND company_id = ${target.companyId}
          AND deleted_at IS NULL
        FOR SHARE
      `
    case 'jobCategory':
      return tx.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM job_categories
        WHERE id = ${target.id}
          AND company_id = ${target.companyId}
          AND deleted_at IS NULL
        FOR SHARE
      `
    case 'position':
      return tx.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM positions
        WHERE id = ${target.id}
          AND company_id = ${target.companyId}
          AND deleted_at IS NULL
        FOR SHARE
      `
    case 'workLocation':
      return tx.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM work_locations
        WHERE id = ${target.id}
          AND company_id = ${target.companyId}
          AND deleted_at IS NULL
        FOR SHARE
      `
  }
}

function assertTransactionClient(tx: PrismaTx): void {
  const candidate = tx as unknown as {
    $connect?: unknown
    $disconnect?: unknown
  }
  if (
    typeof candidate.$connect === 'function' ||
    typeof candidate.$disconnect === 'function'
  ) {
    throw new AppError(
      500,
      'PRIMARY_ASSIGNMENT_TRANSACTION_REQUIRED',
      '주 발령 잠금에는 데이터베이스 트랜잭션이 필요합니다.',
    )
  }
}

export function primaryAssignmentDepartmentScopeKey(
  scope: PrimaryAssignmentDepartmentScope,
): string {
  const companyId = requireNonEmpty(scope.companyId, 'companyId')
  const departmentId = scope.departmentId === null
    ? NULL_DEPARTMENT_SENTINEL
    : requireNonEmpty(scope.departmentId, 'departmentId')
  return `${companyId}:${departmentId}`
}

export function sortPrimaryAssignmentDepartmentScopes(
  scopes: readonly PrimaryAssignmentDepartmentScope[],
): PrimaryAssignmentDepartmentScope[] {
  const byKey = new Map<string, PrimaryAssignmentDepartmentScope>()
  for (const scope of scopes) {
    const normalized = {
      companyId: requireNonEmpty(scope.companyId, 'companyId'),
      departmentId: scope.departmentId === null
        ? null
        : requireNonEmpty(scope.departmentId, 'departmentId'),
    }
    byKey.set(primaryAssignmentDepartmentScopeKey(normalized), normalized)
  }
  return [...byKey.entries()]
    .sort(([left], [right]) => compareCanonicalKey(left, right))
    .map(([, scope]) => scope)
}

export function sortPrimaryAssignmentEmployeeIds(
  employeeIds: readonly string[],
): string[] {
  return [...new Set(employeeIds.map((value) => requireNonEmpty(value, 'employeeId')))]
    .sort(compareCanonicalKey)
}

export async function acquirePrimaryAssignmentDepartmentLocks(
  tx: PrismaTx,
  scopes: readonly PrimaryAssignmentDepartmentScope[],
  deps?: PrimaryAssignmentLockHooks,
): Promise<string[]> {
  assertTransactionClient(tx)
  const sortedScopes = sortPrimaryAssignmentDepartmentScopes(scopes)
  const lockedKeys: string[] = []
  for (const scope of sortedScopes) {
    const key = primaryAssignmentDepartmentScopeKey(scope)
    const advisoryKey = `${DEPARTMENT_LOCK_NAMESPACE}:${key}`
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtextextended(${advisoryKey}, 0))
    `
    lockedKeys.push(key)
    await deps?.afterPrimaryAssignmentDepartmentLock?.({ key })
  }
  return lockedKeys
}

export async function revalidatePrimaryAssignmentDepartments(
  tx: PrismaTx,
  scopes: readonly PrimaryAssignmentDepartmentScope[],
): Promise<void> {
  assertTransactionClient(tx)
  const required = sortPrimaryAssignmentDepartmentScopes(scopes)
    .filter((scope): scope is { companyId: string; departmentId: string } =>
      scope.departmentId !== null,
    )
  if (required.length === 0) return

  const departments = await tx.department.findMany({
    where: {
      OR: required.map((scope) => ({
        id: scope.departmentId,
        companyId: scope.companyId,
        deletedAt: null,
      })),
    },
    select: { id: true, companyId: true },
  })
  const found = new Set(
    departments.map((department) =>
      primaryAssignmentDepartmentScopeKey({
        companyId: department.companyId,
        departmentId: department.id,
      }),
    ),
  )
  const missing = required.find(
    (scope) => !found.has(primaryAssignmentDepartmentScopeKey(scope)),
  )
  if (missing) {
    throw conflict('부서가 변경되었거나 삭제되었습니다. 다시 시도해 주세요.')
  }
}

export async function revalidatePrimaryAssignmentMasterData(
  tx: PrismaTx,
  data: PrimaryAssignmentMasterData,
): Promise<void> {
  await revalidatePrimaryAssignmentMasterDataSet(tx, [data])
}

export async function revalidatePrimaryAssignmentMasterDataSet(
  tx: PrismaTx,
  dataSet: readonly PrimaryAssignmentMasterData[],
): Promise<void> {
  assertTransactionClient(tx)
  // Canonical cross-table order is lexical `type:id`:
  // company -> jobCategory -> jobGrade -> position -> title -> workLocation,
  // then ID. Each company participates once even when a batch has many rows.
  // FOR SHARE also conflicts with non-key UPDATE, so deleted_at soft-deletes
  // cannot pass validation until the assignment transaction completes.
  const targets = primaryAssignmentMasterDataLockTargets(dataSet)
  for (const target of targets) {
    const locked = await lockPrimaryAssignmentMasterDataRow(tx, target)
    if (locked.length !== 1 || locked[0]?.id !== target.id) {
      throw badRequest(PRIMARY_ASSIGNMENT_MASTER_DATA_ERRORS[target.type])
    }
  }
}

export async function acquirePrimaryAssignmentEmployeeLocks(
  tx: PrismaTx,
  employeeIds: readonly string[],
  deps?: PrimaryAssignmentLockHooks,
): Promise<string[]> {
  assertTransactionClient(tx)
  const sortedIds = sortPrimaryAssignmentEmployeeIds(employeeIds)
  for (const employeeId of sortedIds) {
    const key = `${EMPLOYEE_LOCK_NAMESPACE}:${employeeId}`
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))
    `
    await deps?.afterPrimaryAssignmentEmployeeLock?.({ employeeId, key })
  }
  return sortedIds
}

export function validatePrimaryAssignmentTimeline(
  rows: readonly PrimaryAssignmentInterval[],
): void {
  const sorted = [...rows].sort(
    (left, right) =>
      left.effectiveDate.getTime() - right.effectiveDate.getTime() ||
      compareCanonicalKey(left.id, right.id),
  )

  const occupying: PrimaryAssignmentInterval[] = []
  const effectiveCountByStart = new Map<number, number>()
  for (const row of sorted) {
    const start = row.effectiveDate.getTime()
    const end = row.endDate?.getTime() ?? null
    if (Number.isNaN(start) || (end !== null && Number.isNaN(end))) {
      throw conflict('주 발령 날짜가 올바르지 않습니다.')
    }
    if (end !== null && end < start) {
      throw conflict('주 발령 종료일은 시작일보다 빠를 수 없습니다.')
    }
    // [D,D) is an audit tombstone and occupies no effective date.
    if (end === start) continue

    const count = (effectiveCountByStart.get(start) ?? 0) + 1
    effectiveCountByStart.set(start, count)
    if (count > 1) {
      throw conflict('같은 시작일에 유효한 주 발령이 중복되어 있습니다.')
    }
    occupying.push(row)
  }

  for (let index = 1; index < occupying.length; index += 1) {
    const previous = occupying[index - 1]
    const current = occupying[index]
    if (
      previous.endDate === null ||
      current.effectiveDate.getTime() < previous.endDate.getTime()
    ) {
      throw conflict('주 발령 유효기간이 중복되어 있습니다.')
    }
  }
}

export async function readPrimaryAssignmentTimeline(
  tx: PrismaTx,
  employeeId: string,
  deps?: PrimaryAssignmentLockHooks,
): Promise<EmployeeAssignment[]> {
  assertTransactionClient(tx)
  const normalizedEmployeeId = requireNonEmpty(employeeId, 'employeeId')
  const timeline = await tx.employeeAssignment.findMany({
    where: { employeeId: normalizedEmployeeId, isPrimary: true },
    orderBy: [{ effectiveDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
  })
  validatePrimaryAssignmentTimeline(timeline)
  await deps?.afterPrimaryAssignmentTimelineRead?.({
    employeeId: normalizedEmployeeId,
    assignmentIds: timeline.map((assignment) => assignment.id),
  })
  return timeline
}

export function getPrimaryAssignmentAtDate(
  timeline: readonly EmployeeAssignment[],
  date: Date,
): EmployeeAssignment | null {
  const boundary = date.getTime()
  const matches = timeline.filter((assignment) =>
    assignment.effectiveDate.getTime() <= boundary &&
    (assignment.endDate === null || assignment.endDate.getTime() > boundary),
  )
  if (matches.length > 1) {
    throw conflict('해당 날짜에 유효한 주 발령이 중복되어 있습니다.')
  }
  return matches[0] ?? null
}

export function getOpenPrimaryAssignment(
  timeline: readonly EmployeeAssignment[],
): EmployeeAssignment | null {
  const open = timeline.filter((assignment) => assignment.endDate === null)
  if (open.length > 1) throw conflict('종료되지 않은 주 발령이 중복되어 있습니다.')
  return open[0] ?? null
}

export function assertPrimaryAssignmentReplacement(params: {
  timeline: readonly PrimaryAssignmentInterval[]
  replacedAssignmentId: string | null
  closeDate: Date | null
  nextEffectiveDate: Date
  nextEndDate?: Date | null
}): void {
  let replaced = params.replacedAssignmentId === null
  const projected = params.timeline.map((assignment) => {
    if (assignment.id !== params.replacedAssignmentId) return assignment
    replaced = true
    return { ...assignment, endDate: params.closeDate }
  })
  if (!replaced) throw conflict('교체할 주 발령을 찾을 수 없습니다.')
  projected.push({
    id: `__next__:${params.nextEffectiveDate.toISOString()}`,
    effectiveDate: params.nextEffectiveDate,
    endDate: params.nextEndDate ?? null,
  })
  validatePrimaryAssignmentTimeline(projected)
}

export function assertPrimaryAssignmentSourceScopeLocked(
  lockedDepartmentKeys: readonly string[] | ReadonlySet<string>,
  assignment: Pick<EmployeeAssignment, 'companyId' | 'departmentId'>,
): void {
  const key = primaryAssignmentDepartmentScopeKey(assignment)
  const locked = new Set(lockedDepartmentKeys).has(key)
  if (!locked) {
    throw new AppError(
      409,
      PRIMARY_ASSIGNMENT_RETRY_CODE,
      '주 발령의 소속 부서가 변경되었습니다. 전체 작업을 다시 시도합니다.',
      { sourceDepartmentKey: key },
    )
  }
}

export async function casPrimaryAssignment(
  tx: PrismaTx,
  expected: EmployeeAssignment,
  data: PrimaryAssignmentUpdateData,
): Promise<void> {
  assertTransactionClient(tx)
  const updated = await tx.employeeAssignment.updateMany({
    where: {
      id: expected.id,
      employeeId: expected.employeeId,
      effectiveDate: expected.effectiveDate,
      endDate: expected.endDate,
      changeType: expected.changeType,
      companyId: expected.companyId,
      departmentId: expected.departmentId,
      jobGradeId: expected.jobGradeId,
      jobCategoryId: expected.jobCategoryId,
      employmentType: expected.employmentType,
      contractType: expected.contractType,
      status: expected.status,
      positionId: expected.positionId,
      isPrimary: true,
      workLocationId: expected.workLocationId,
      titleId: expected.titleId,
      updatedAt: expected.updatedAt,
    },
    data,
  })
  if (updated.count !== 1) {
    throw conflict('주 발령이 다른 작업에서 변경되었습니다. 다시 시도해 주세요.')
  }
}

function isRetryablePrimaryAssignmentError(error: unknown): boolean {
  if (error instanceof AppError) return error.code === PRIMARY_ASSIGNMENT_RETRY_CODE
  return (error as { code?: unknown } | null)?.code === 'P2034'
}

export async function withPrimaryAssignmentRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts?: number
    deps?: PrimaryAssignmentLockHooks
  } = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_RETRY_ATTEMPTS
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw badRequest('주 발령 트랜잭션 재시도 횟수가 올바르지 않습니다.')
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      if (!isRetryablePrimaryAssignmentError(error)) {
        throw error
      }
      if (attempt === maxAttempts) {
        if (error instanceof AppError) throw error
        throw conflict('동시 주 발령 작업과 충돌했습니다. 다시 시도해 주세요.')
      }
      await options.deps?.onPrimaryAssignmentRetry?.({ attempt, error })
    }
  }
  throw conflict('주 발령 작업을 완료하지 못했습니다. 다시 시도해 주세요.')
}
