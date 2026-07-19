import 'server-only'

import {
  acquirePrimaryAssignmentDepartmentLocks,
  revalidatePrimaryAssignmentDepartments,
  type PrimaryAssignmentLockHooks,
} from '@/lib/employee/primary-assignment-writer'
import { conflict, notFound } from '@/lib/errors'
import { prisma } from '@/lib/prisma'

export interface SoftDeleteDepartmentInput {
  id: string
  companyId: string
  expectedParentId: string | null
}

export interface DepartmentLifecycleDeps extends PrimaryAssignmentLockHooks {
  db?: typeof prisma
  now?: () => Date
}

export async function softDeleteDepartment(
  input: SoftDeleteDepartmentInput,
  deps: DepartmentLifecycleDeps = {},
): Promise<{ id: string; deletedAt: Date }> {
  const db = deps.db ?? prisma
  return db.$transaction(async (tx) => {
    const scopes = [
      { companyId: input.companyId, departmentId: input.id },
      { companyId: input.companyId, departmentId: input.expectedParentId },
    ]
    await acquirePrimaryAssignmentDepartmentLocks(tx, scopes, deps)
    await revalidatePrimaryAssignmentDepartments(tx, scopes)

    const locked = await tx.department.findFirst({
      where: {
        id: input.id,
        companyId: input.companyId,
        deletedAt: null,
      },
      select: { id: true, parentId: true },
    })
    if (!locked) throw notFound('부서를 찾을 수 없습니다.')
    if (locked.parentId !== input.expectedParentId) {
      throw conflict('부서 소속이 변경되었습니다. 다시 시도해 주세요.')
    }

    const [activeChildren, activeAssignments] = await Promise.all([
      tx.department.count({
        where: { parentId: locked.id, deletedAt: null },
      }),
      tx.employeeAssignment.count({
        where: { departmentId: locked.id, endDate: null },
      }),
    ])
    if (activeChildren > 0) {
      throw conflict(
        '하위 부서가 있는 부서는 삭제할 수 없습니다. 먼저 하위 부서를 이동하거나 삭제해 주세요.',
      )
    }
    if (activeAssignments > 0) {
      throw conflict(
        '현재 소속 직원이 있는 부서는 삭제할 수 없습니다. 먼저 직원을 다른 부서로 이동해 주세요.',
      )
    }

    const deletedAt = deps.now?.() ?? new Date()
    const deleted = await tx.department.updateMany({
      where: {
        id: locked.id,
        companyId: input.companyId,
        parentId: locked.parentId,
        deletedAt: null,
      },
      data: { deletedAt },
    })
    if (deleted.count !== 1) {
      throw conflict('부서가 다른 작업에서 변경되었습니다. 다시 시도해 주세요.')
    }
    return { id: locked.id, deletedAt }
  })
}
