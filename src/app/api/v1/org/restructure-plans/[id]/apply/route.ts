// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/org/restructure-plans/[id]/apply
// B8-1 Task 6: 조직 개편 플랜 적용 (Effective Dating)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { AppError, badRequest, conflict, notFound, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { invalidateMultiple, CACHE_STRATEGY } from '@/lib/cache'
import {
  PRIMARY_ASSIGNMENT_RETRY_CODE,
  acquirePrimaryAssignmentDepartmentLocks,
  acquirePrimaryAssignmentEmployeeLocks,
  assertPrimaryAssignmentReplacement,
  assertPrimaryAssignmentSourceScopeLocked,
  casPrimaryAssignment,
  getPrimaryAssignmentAtDate,
  primaryAssignmentDepartmentScopeKey,
  readPrimaryAssignmentTimeline,
  revalidatePrimaryAssignmentDepartments,
  revalidatePrimaryAssignmentMasterDataSet,
  validatePrimaryAssignmentTimeline,
  withPrimaryAssignmentRetry,
  type PrimaryAssignmentDepartmentScope,
} from '@/lib/employee/primary-assignment-writer'
import type { EmployeeAssignment, Prisma } from '@/generated/prisma/client'
import type { PrismaTx } from '@/lib/prisma-rls'
import type { SessionUser } from '@/types'

type RouteContext = { params: Promise<Record<string, string>> }

// ─── Change type definitions (mirrors RestructureModal) ─────

interface OrgChange {
  id: string
  type: 'create' | 'move' | 'merge' | 'rename' | 'close' | 'transfer_employee'
  // create
  newDeptName?: string
  newDeptCode?: string
  newDeptParentId?: string | null
  // move
  deptId?: string
  targetParentId?: string | null
  // merge
  sourceDeptId?: string
  targetDeptId?: string
  // rename
  renameDeptId?: string
  newName?: string
  newNameEn?: string
  // close
  closeDeptId?: string
  // transfer_employee
  employeeId?: string
  fromDeptId?: string
  toDeptId?: string
}

type AssignmentTimeline = EmployeeAssignment[]

type PlanCandidateAssignment = Pick<
  EmployeeAssignment,
  | 'id'
  | 'employeeId'
  | 'companyId'
  | 'departmentId'
  | 'jobGradeId'
  | 'titleId'
  | 'jobCategoryId'
  | 'positionId'
  | 'workLocationId'
>

function matchesPlanCandidate(
  current: EmployeeAssignment,
  candidate: PlanCandidateAssignment,
): boolean {
  return current.id === candidate.id &&
    current.companyId === candidate.companyId &&
    current.departmentId === candidate.departmentId &&
    current.jobGradeId === candidate.jobGradeId &&
    current.titleId === candidate.titleId &&
    current.jobCategoryId === candidate.jobCategoryId &&
    current.positionId === candidate.positionId &&
    current.workLocationId === candidate.workLocationId
}

function addDepartmentScope(
  scopes: Map<string, PrimaryAssignmentDepartmentScope>,
  companyId: string,
  departmentId: string | null,
): void {
  const scope = { companyId, departmentId }
  scopes.set(primaryAssignmentDepartmentScopeKey(scope), scope)
}

function collectDirectDepartmentScopes(
  companyId: string,
  changes: readonly OrgChange[],
): Map<string, PrimaryAssignmentDepartmentScope> {
  const scopes = new Map<string, PrimaryAssignmentDepartmentScope>()

  for (const change of changes) {
    switch (change.type) {
      case 'create':
        if (change.newDeptName && change.newDeptCode) {
          addDepartmentScope(scopes, companyId, change.newDeptParentId ?? null)
        }
        break
      case 'move':
        if (change.deptId) {
          addDepartmentScope(scopes, companyId, change.deptId)
          addDepartmentScope(scopes, companyId, change.targetParentId ?? null)
        }
        break
      case 'merge':
        if (change.sourceDeptId && change.targetDeptId) {
          addDepartmentScope(scopes, companyId, change.sourceDeptId)
          addDepartmentScope(scopes, companyId, change.targetDeptId)
        }
        break
      case 'rename':
        if (change.renameDeptId && change.newName) {
          addDepartmentScope(scopes, companyId, change.renameDeptId)
        }
        break
      case 'close':
        if (change.closeDeptId) {
          addDepartmentScope(scopes, companyId, change.closeDeptId)
        }
        break
      case 'transfer_employee':
        if (change.employeeId && change.toDeptId) {
          if (change.fromDeptId) {
            addDepartmentScope(scopes, companyId, change.fromDeptId)
          }
          addDepartmentScope(scopes, companyId, change.toDeptId)
        }
        break
    }
  }

  return scopes
}

function collectHierarchySubjectIds(changes: readonly OrgChange[]): string[] {
  const ids = new Set<string>()
  for (const change of changes) {
    if (change.type === 'move' && change.deptId) ids.add(change.deptId)
    if (change.type === 'close' && change.closeDeptId) ids.add(change.closeDeptId)
  }
  return [...ids]
}

function collectExplicitEmployeeIds(changes: readonly OrgChange[]): string[] {
  return [...new Set(
    changes
      .filter(
        (change) =>
          change.type === 'transfer_employee' &&
          Boolean(change.employeeId) &&
          Boolean(change.toDeptId),
      )
      .map((change) => change.employeeId!),
  )]
}

function collectPredicateSourceDepartmentIds(changes: readonly OrgChange[]): string[] {
  const ids = new Set<string>()
  for (const change of changes) {
    if (change.type === 'merge' && change.sourceDeptId && change.targetDeptId) {
      ids.add(change.sourceDeptId)
    }
    if (change.type === 'close' && change.closeDeptId) ids.add(change.closeDeptId)
  }
  return [...ids]
}

async function discoverPlanDepartmentScopes(
  tx: PrismaTx,
  companyId: string,
  changes: readonly OrgChange[],
  effectiveDate: Date,
): Promise<PrimaryAssignmentDepartmentScope[]> {
  const scopes = collectDirectDepartmentScopes(companyId, changes)
  const hierarchySubjectIds = collectHierarchySubjectIds(changes)
  if (hierarchySubjectIds.length > 0) {
    const hierarchyHints = await tx.department.findMany({
      where: {
        id: { in: hierarchySubjectIds },
        companyId,
        deletedAt: null,
      },
      select: { parentId: true },
    })
    for (const hint of hierarchyHints) {
      addDepartmentScope(scopes, companyId, hint.parentId)
    }
  }

  const explicitEmployeeIds = collectExplicitEmployeeIds(changes)
  if (explicitEmployeeIds.length > 0) {
    const sourceHints = await tx.employeeAssignment.findMany({
      where: {
        employeeId: { in: explicitEmployeeIds },
        isPrimary: true,
        effectiveDate: { lte: effectiveDate },
        OR: [{ endDate: null }, { endDate: { gt: effectiveDate } }],
      },
      select: { companyId: true, departmentId: true },
    })
    for (const hint of sourceHints) {
      addDepartmentScope(scopes, hint.companyId, hint.departmentId)
    }
  }

  return [...scopes.values()]
}

async function discoverPlanCandidateAssignments(
  tx: PrismaTx,
  companyId: string,
  changes: readonly OrgChange[],
  effectiveDate: Date,
) {
  const sourceDepartmentIds = collectPredicateSourceDepartmentIds(changes)
  const explicitEmployeeIds = collectExplicitEmployeeIds(changes)
  const candidatePredicates: Prisma.EmployeeAssignmentWhereInput[] = []
  if (sourceDepartmentIds.length > 0) {
    candidatePredicates.push({
      companyId,
      departmentId: { in: sourceDepartmentIds },
    })
  }
  if (explicitEmployeeIds.length > 0) {
    candidatePredicates.push({ employeeId: { in: explicitEmployeeIds } })
  }
  if (candidatePredicates.length === 0) return []

  return tx.employeeAssignment.findMany({
    where: {
      isPrimary: true,
      effectiveDate: { lte: effectiveDate },
      AND: [
        { OR: [{ endDate: null }, { endDate: { gt: effectiveDate } }] },
        { OR: candidatePredicates },
      ],
    },
    select: {
      id: true,
      employeeId: true,
      companyId: true,
      departmentId: true,
      jobGradeId: true,
      titleId: true,
      jobCategoryId: true,
      positionId: true,
      workLocationId: true,
    },
  })
}

function assertDepartmentScopeLocked(
  lockedDepartmentKeys: ReadonlySet<string>,
  scope: PrimaryAssignmentDepartmentScope,
): void {
  const key = primaryAssignmentDepartmentScopeKey(scope)
  if (lockedDepartmentKeys.has(key)) return
  throw new AppError(
    409,
    PRIMARY_ASSIGNMENT_RETRY_CODE,
    '부서 구조가 변경되었습니다. 전체 작업을 다시 시도합니다.',
    { sourceDepartmentKey: key },
  )
}

async function collectRequiredDepartmentScopes(
  tx: PrismaTx,
  companyId: string,
  changes: readonly OrgChange[],
  lockedDepartmentKeys: ReadonlySet<string>,
): Promise<PrimaryAssignmentDepartmentScope[]> {
  const required = collectDirectDepartmentScopes(companyId, changes)
  const hierarchySubjectIds = collectHierarchySubjectIds(changes)
  if (hierarchySubjectIds.length > 0) {
    const departments = await tx.department.findMany({
      where: {
        id: { in: hierarchySubjectIds },
        companyId,
        deletedAt: null,
      },
      select: { id: true, parentId: true },
    })
    const byId = new Map(departments.map((department) => [department.id, department]))
    for (const departmentId of hierarchySubjectIds) {
      const department = byId.get(departmentId)
      if (!department) {
        throw conflict('부서가 변경되었거나 삭제되었습니다. 다시 시도해 주세요.')
      }
      const parentScope = { companyId, departmentId: department.parentId }
      assertDepartmentScopeLocked(lockedDepartmentKeys, parentScope)
      addDepartmentScope(required, companyId, department.parentId)
    }
  }

  return [...required.values()]
}

async function requireActiveDepartment(
  tx: PrismaTx,
  departmentId: string,
  companyId: string,
  label: string,
) {
  const department = await tx.department.findFirst({
    where: { id: departmentId, companyId, deletedAt: null },
  })
  if (!department) {
    throw conflict(`${label} 부서가 변경되었거나 삭제되었습니다. 다시 시도해 주세요.`)
  }
  return department
}

async function replacePrimaryAssignment(
  tx: PrismaTx,
  timelines: Map<string, AssignmentTimeline>,
  lockedDepartmentKeys: ReadonlySet<string>,
  current: EmployeeAssignment,
  effectiveDate: Date,
  targetDepartmentId: string | null,
  changeType: 'REORGANIZATION' | 'TRANSFER',
  reason: string,
  approvedById: string,
): Promise<void> {
  const timeline = timelines.get(current.employeeId)
  if (!timeline) throw conflict('직원의 주 발령 정보를 다시 확인해 주세요.')

  assertPrimaryAssignmentSourceScopeLocked(lockedDepartmentKeys, current)
  assertDepartmentScopeLocked(lockedDepartmentKeys, {
    companyId: current.companyId,
    departmentId: targetDepartmentId,
  })
  assertPrimaryAssignmentReplacement({
    timeline,
    replacedAssignmentId: current.id,
    closeDate: effectiveDate,
    nextEffectiveDate: effectiveDate,
  })
  await casPrimaryAssignment(tx, current, { endDate: effectiveDate })
  const nextAssignment = await tx.employeeAssignment.create({
    data: {
      employeeId: current.employeeId,
      effectiveDate,
      endDate: null,
      changeType,
      companyId: current.companyId,
      departmentId: targetDepartmentId,
      jobGradeId: current.jobGradeId,
      jobCategoryId: current.jobCategoryId,
      employmentType: current.employmentType,
      contractType: current.contractType,
      status: current.status,
      positionId: current.positionId,
      workLocationId: current.workLocationId,
      titleId: current.titleId,
      isPrimary: true,
      reason,
      approvedById,
    },
  })

  const nextTimeline = timeline.map((assignment) =>
    assignment.id === current.id
      ? { ...assignment, endDate: effectiveDate }
      : assignment,
  )
  nextTimeline.push(nextAssignment)
  validatePrimaryAssignmentTimeline(nextTimeline)
  timelines.set(current.employeeId, nextTimeline)
}

async function assertDepartmentCanClose(
  tx: PrismaTx,
  departmentId: string,
  companyId: string,
): Promise<void> {
  const [activeChildren, openAssignments] = await Promise.all([
    tx.department.count({
      where: { parentId: departmentId, companyId, deletedAt: null },
    }),
    tx.employeeAssignment.count({
      where: { departmentId, companyId, endDate: null },
    }),
  ])
  if (activeChildren > 0) {
    throw conflict('하위 부서가 있는 부서는 폐지할 수 없습니다.')
  }
  if (openAssignments > 0) {
    throw conflict('이동되지 않은 소속 직원이 있어 부서를 폐지할 수 없습니다.')
  }
}

// ─── POST /api/v1/org/restructure-plans/[id]/apply ──────────

export const POST = withPermission(
  async (req: NextRequest, context: RouteContext, user: SessionUser) => {
    const { id } = await context.params

    const plan = await prisma.orgRestructurePlan.findUnique({ where: { id } })
    if (!plan) throw notFound('개편 계획을 찾을 수 없습니다.')

    if (user.role !== ROLE.SUPER_ADMIN && plan.companyId !== user.companyId) {
      throw notFound('개편 계획을 찾을 수 없습니다.')
    }
    if (plan.appliedAt) {
      throw badRequest('이미 적용된 계획입니다.')
    }

    try {
      const appliedPlan = await withPrimaryAssignmentRetry(() =>
        prisma.$transaction(async (tx) => {
          const locked = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT id
            FROM org_restructure_plans
            WHERE id = ${id}
            FOR UPDATE
          `
          if (locked.length !== 1) throw notFound('개편 계획을 찾을 수 없습니다.')

          const freshPlan = await tx.orgRestructurePlan.findUnique({ where: { id } })
          if (!freshPlan) throw notFound('개편 계획을 찾을 수 없습니다.')
          if (user.role !== ROLE.SUPER_ADMIN && freshPlan.companyId !== user.companyId) {
            throw notFound('개편 계획을 찾을 수 없습니다.')
          }
          if (freshPlan.appliedAt || freshPlan.status === 'applied') {
            throw badRequest('이미 적용된 계획입니다.')
          }
          if (!Array.isArray(freshPlan.changes)) {
            throw badRequest('개편 계획의 변경 데이터가 올바르지 않습니다.')
          }

          const changes = freshPlan.changes as unknown as OrgChange[]
          const effectiveDate = freshPlan.effectiveDate
          const departmentScopes = await discoverPlanDepartmentScopes(
            tx,
            freshPlan.companyId,
            changes,
            effectiveDate,
          )
          const lockedDepartmentKeys = new Set(
            await acquirePrimaryAssignmentDepartmentLocks(tx, departmentScopes),
          )
          const requiredDepartmentScopes = await collectRequiredDepartmentScopes(
            tx,
            freshPlan.companyId,
            changes,
            lockedDepartmentKeys,
          )
          await revalidatePrimaryAssignmentDepartments(tx, requiredDepartmentScopes)

          const candidateAssignments = await discoverPlanCandidateAssignments(
            tx,
            freshPlan.companyId,
            changes,
            effectiveDate,
          )
          const candidateDepartmentScopes = new Map<
            string,
            PrimaryAssignmentDepartmentScope
          >()
          for (const candidate of candidateAssignments) {
            assertPrimaryAssignmentSourceScopeLocked(lockedDepartmentKeys, candidate)
            addDepartmentScope(
              candidateDepartmentScopes,
              candidate.companyId,
              candidate.departmentId,
            )
          }
          await revalidatePrimaryAssignmentDepartments(
            tx,
            [...candidateDepartmentScopes.values()],
          )
          await revalidatePrimaryAssignmentMasterDataSet(tx, candidateAssignments)

          const employeeIds = [
            ...candidateAssignments.map((candidate) => candidate.employeeId),
            ...collectExplicitEmployeeIds(changes),
          ]
          const lockedEmployeeIds = await acquirePrimaryAssignmentEmployeeLocks(tx, employeeIds)
          const candidatesByEmployeeId = new Map<string, PlanCandidateAssignment[]>()
          for (const candidate of candidateAssignments) {
            const candidates = candidatesByEmployeeId.get(candidate.employeeId) ?? []
            candidates.push(candidate)
            candidatesByEmployeeId.set(candidate.employeeId, candidates)
          }
          const timelines = new Map<string, AssignmentTimeline>()
          for (const employeeId of lockedEmployeeIds) {
            const timeline = await readPrimaryAssignmentTimeline(tx, employeeId)
            const current = getPrimaryAssignmentAtDate(timeline, effectiveDate)
            if (current) {
              assertPrimaryAssignmentSourceScopeLocked(lockedDepartmentKeys, current)
              const matchesCandidate = candidatesByEmployeeId
                .get(employeeId)
                ?.some((candidate) => matchesPlanCandidate(current, candidate))
              if (!matchesCandidate) {
                throw new AppError(
                  409,
                  PRIMARY_ASSIGNMENT_RETRY_CODE,
                  '직원의 주 발령이 변경되었습니다. 전체 작업을 다시 시도합니다.',
                  { employeeId },
                )
              }
            }
            timelines.set(employeeId, timeline)
          }

          for (const change of changes) {
            switch (change.type) {
            // ── 1. 부서 신설 ────────────────────────────────────────
            case 'create': {
              if (!change.newDeptName || !change.newDeptCode) break

              // Determine level from parent
              let level = 0
              if (change.newDeptParentId) {
                const parent = await requireActiveDepartment(
                  tx,
                  change.newDeptParentId,
                  freshPlan.companyId,
                  '신설 상위',
                )
                level = parent.level + 1
              }

              await tx.department.create({
                data: {
                  companyId: freshPlan.companyId,
                  name: change.newDeptName,
                  code: change.newDeptCode,
                  level,
                  parentId: change.newDeptParentId ?? null,
                  deletedAt: null,
                  sortOrder: 999,
                },
              })
              break
            }

            // ── 2. 부서 이동 ────────────────────────────────────────
            case 'move': {
              if (!change.deptId) break

              const department = await requireActiveDepartment(
                tx,
                change.deptId,
                freshPlan.companyId,
                '이동',
              )
              assertDepartmentScopeLocked(lockedDepartmentKeys, {
                companyId: freshPlan.companyId,
                departmentId: department.parentId,
              })

              // Determine new level
              let newLevel = 0
              if (change.targetParentId) {
                const parent = await requireActiveDepartment(
                  tx,
                  change.targetParentId,
                  freshPlan.companyId,
                  '이동 상위',
                )
                newLevel = parent.level + 1
              }

              const moved = await tx.department.updateMany({
                where: {
                  id: department.id,
                  companyId: freshPlan.companyId,
                  parentId: department.parentId,
                  level: department.level,
                  deletedAt: null,
                },
                data: { parentId: change.targetParentId ?? null, level: newLevel },
              })
              if (moved.count !== 1) {
                throw conflict('이동할 부서가 다른 작업에서 변경되었습니다.')
              }
              break
            }

            // ── 3. 부서 통합 ────────────────────────────────────────
            case 'merge': {
              if (!change.sourceDeptId || !change.targetDeptId) break

              if (change.sourceDeptId === change.targetDeptId) {
                throw badRequest('통합 원천 부서와 대상 부서는 달라야 합니다.')
              }

              const source = await requireActiveDepartment(
                tx,
                change.sourceDeptId,
                freshPlan.companyId,
                '통합 원천',
              )
              await requireActiveDepartment(
                tx,
                change.targetDeptId,
                freshPlan.companyId,
                '통합 대상',
              )
              for (const employeeId of lockedEmployeeIds) {
                const timeline = timelines.get(employeeId)!
                const current = getPrimaryAssignmentAtDate(timeline, effectiveDate)
                if (
                  !current ||
                  current.companyId !== freshPlan.companyId ||
                  current.departmentId !== change.sourceDeptId
                ) {
                  continue
                }
                await replacePrimaryAssignment(
                  tx,
                  timelines,
                  lockedDepartmentKeys,
                  current,
                  effectiveDate,
                  change.targetDeptId,
                  'REORGANIZATION',
                  `조직 개편: ${freshPlan.title}`,
                  user.employeeId,
                )
              }

              await assertDepartmentCanClose(tx, source.id, freshPlan.companyId)

              // Mark source department inactive
              const merged = await tx.department.updateMany({
                where: {
                  id: source.id,
                  companyId: freshPlan.companyId,
                  parentId: source.parentId,
                  deletedAt: null,
                },
                data: { deletedAt: new Date() },
              })
              if (merged.count !== 1) {
                throw conflict('통합 원천 부서가 다른 작업에서 변경되었습니다.')
              }
              break
            }

            // ── 4. 부서 명칭 변경 ───────────────────────────────────
            case 'rename': {
              if (!change.renameDeptId || !change.newName) break
              const department = await requireActiveDepartment(
                tx,
                change.renameDeptId,
                freshPlan.companyId,
                '명칭 변경',
              )
              const renamed = await tx.department.updateMany({
                where: {
                  id: department.id,
                  companyId: freshPlan.companyId,
                  name: department.name,
                  nameEn: department.nameEn,
                  deletedAt: null,
                },
                data: {
                  name: change.newName,
                  nameEn: change.newNameEn ?? undefined,
                },
              })
              if (renamed.count !== 1) {
                throw conflict('명칭을 변경할 부서가 다른 작업에서 변경되었습니다.')
              }
              break
            }

            // ── 5. 부서 폐지 ────────────────────────────────────────
            case 'close': {
              if (!change.closeDeptId) break

              // Find parent dept for reassignment
              const closingDept = await requireActiveDepartment(
                tx,
                change.closeDeptId,
                freshPlan.companyId,
                '폐지',
              )
              const parentScope = {
                companyId: freshPlan.companyId,
                departmentId: closingDept.parentId,
              }
              assertDepartmentScopeLocked(lockedDepartmentKeys, parentScope)
              if (closingDept.parentId) {
                await requireActiveDepartment(
                  tx,
                  closingDept.parentId,
                  freshPlan.companyId,
                  '폐지 후 이동 대상',
                )
              }

              for (const employeeId of lockedEmployeeIds) {
                const timeline = timelines.get(employeeId)!
                const current = getPrimaryAssignmentAtDate(timeline, effectiveDate)
                if (
                  !current ||
                  current.companyId !== freshPlan.companyId ||
                  current.departmentId !== change.closeDeptId
                ) {
                  continue
                }
                await replacePrimaryAssignment(
                  tx,
                  timelines,
                  lockedDepartmentKeys,
                  current,
                  effectiveDate,
                  closingDept.parentId,
                  'REORGANIZATION',
                  `조직 개편(폐지): ${freshPlan.title}`,
                  user.employeeId,
                )
              }

              await assertDepartmentCanClose(tx, closingDept.id, freshPlan.companyId)

              const closed = await tx.department.updateMany({
                where: {
                  id: closingDept.id,
                  companyId: freshPlan.companyId,
                  parentId: closingDept.parentId,
                  deletedAt: null,
                },
                data: { deletedAt: new Date() },
              })
              if (closed.count !== 1) {
                throw conflict('폐지할 부서가 다른 작업에서 변경되었습니다.')
              }
              break
            }

            // ── 6. 인원 이동 ────────────────────────────────────────
            case 'transfer_employee': {
              if (!change.employeeId || !change.toDeptId) break

              await requireActiveDepartment(
                tx,
                change.toDeptId,
                freshPlan.companyId,
                '인원 이동 대상',
              )
              const timeline = timelines.get(change.employeeId)
              if (!timeline) throw conflict('이동할 직원의 주 발령을 찾을 수 없습니다.')
              const currentAssignment = getPrimaryAssignmentAtDate(timeline, effectiveDate)
              if (!currentAssignment) {
                throw conflict('적용일에 유효한 직원 주 발령을 찾을 수 없습니다.')
              }
              assertPrimaryAssignmentSourceScopeLocked(
                lockedDepartmentKeys,
                currentAssignment,
              )
              if (currentAssignment.companyId !== freshPlan.companyId) {
                throw conflict('직원의 현재 소속 법인이 개편 계획과 일치하지 않습니다.')
              }
              if (
                change.fromDeptId &&
                currentAssignment.departmentId !== change.fromDeptId
              ) {
                throw conflict('직원의 현재 소속 부서가 개편 계획과 일치하지 않습니다.')
              }
              await replacePrimaryAssignment(
                tx,
                timelines,
                lockedDepartmentKeys,
                currentAssignment,
                effectiveDate,
                change.toDeptId,
                'TRANSFER',
                `조직 개편: ${freshPlan.title}`,
                user.employeeId,
              )
              break
            }
            }
          }

          // Record in OrgChangeHistory
          await tx.orgChangeHistory.create({
            data: {
              companyId: freshPlan.companyId,
              changeType: 'RESTRUCTURE',
              effectiveDate,
              reason: freshPlan.title,
              approvedById: user.employeeId,
            },
          })

          // Mark plan as applied with the lifecycle state read under the row lock.
          const now = new Date()
          const applied = await tx.orgRestructurePlan.updateMany({
            where: {
              id: freshPlan.id,
              companyId: freshPlan.companyId,
              status: freshPlan.status,
              appliedAt: null,
              updatedAt: freshPlan.updatedAt,
            },
            data: {
              status: 'applied',
              appliedAt: now,
              approvedById: freshPlan.approvedById ?? user.employeeId,
              approvedAt: freshPlan.approvedAt ?? now,
            },
          })
          if (applied.count !== 1) {
            throw conflict('개편 계획 상태가 다른 작업에서 변경되었습니다.')
          }

          return { id: freshPlan.id, companyId: freshPlan.companyId }
        }, { timeout: 60_000 }),
      )

      // 조직 구조 변경 → 관련 캐시 무효화 (rules/performance.md; Redis 실패는 silent)
      await invalidateMultiple(
        [CACHE_STRATEGY.ORG_TREE, CACHE_STRATEGY.SIDEBAR, CACHE_STRATEGY.DASHBOARD_KPI],
        appliedPlan.companyId,
      )

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'org.restructure.apply',
        resourceType: 'org_restructure_plan',
        resourceId: appliedPlan.id,
        companyId: appliedPlan.companyId,
        ip,
        userAgent,
      })

      return apiSuccess({ applied: true, planId: appliedPlan.id })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.ORG, ACTION.APPROVE),
)
