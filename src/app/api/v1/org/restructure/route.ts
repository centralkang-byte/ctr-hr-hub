// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/org/restructure
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, conflict, notFound, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { restructureSchema } from '@/lib/schemas/org'
import {
  acquirePrimaryAssignmentDepartmentLocks,
  primaryAssignmentDepartmentScopeKey,
  revalidatePrimaryAssignmentDepartments,
  type PrimaryAssignmentDepartmentScope,
} from '@/lib/employee/primary-assignment-writer'
import type { SessionUser } from '@/types'

// ─── POST /api/v1/org/restructure ─────────────────────────

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = restructureSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const {
      changeType,
      companyId: rawCompanyId,
      effectiveDate,
      affectedDepartmentId,
      fromData,
      toData,
      reason,
      approvedById,
      documentKey,
    } = parsed.data

    // Non-SUPER_ADMIN: silently force companyId to their own company
    const companyId =
      user.role === 'SUPER_ADMIN' ? rawCompanyId : user.companyId

    const toDataRecord = toData as Record<string, unknown> | undefined
    const renameName = toDataRecord?.name
    const shouldClose = changeType === 'CLOSE' && Boolean(affectedDepartmentId)
    const shouldRename =
      changeType === 'RENAME' &&
      Boolean(affectedDepartmentId) &&
      typeof renameName === 'string'
    const shouldCreate =
      changeType === 'CREATE' &&
      typeof toDataRecord?.code === 'string' &&
      typeof toDataRecord.name === 'string' &&
      typeof toDataRecord.level === 'number'

    // Authorization/candidate hint only. The transaction re-reads after the lock.
    const closeHint = shouldClose
      ? await prisma.department.findFirst({
          where: { id: affectedDepartmentId!, companyId },
          select: { parentId: true },
        })
      : null

    const departmentScopes: PrimaryAssignmentDepartmentScope[] = []
    if ((shouldClose || shouldRename) && affectedDepartmentId) {
      departmentScopes.push({ companyId, departmentId: affectedDepartmentId })
    }
    if (shouldClose && closeHint) {
      departmentScopes.push({ companyId, departmentId: closeHint.parentId })
    }
    if (shouldCreate) {
      departmentScopes.push({
        companyId,
        departmentId:
          typeof toDataRecord.parentId === 'string' ? toDataRecord.parentId : null,
      })
    }

    try {
      const record = await prisma.$transaction(async (tx) => {
        const lockedDepartmentKeys = new Set(
          await acquirePrimaryAssignmentDepartmentLocks(tx, departmentScopes),
        )
        await revalidatePrimaryAssignmentDepartments(tx, departmentScopes)

        // Apply side effects only after lifecycle and membership checks under the lock.
        if (shouldClose && affectedDepartmentId) {
          const department = await tx.department.findFirst({
            where: { id: affectedDepartmentId, companyId, deletedAt: null },
            select: { id: true, parentId: true },
          })
          if (!department) throw notFound('부서를 찾을 수 없습니다.')
          const parentKey = primaryAssignmentDepartmentScopeKey({
            companyId,
            departmentId: department.parentId,
          })
          if (!lockedDepartmentKeys.has(parentKey)) {
            throw conflict('부서 소속이 변경되었습니다. 다시 시도해 주세요.')
          }

          const [activeChildren, openAssignments] = await Promise.all([
            tx.department.count({
              where: {
                parentId: department.id,
                companyId,
                deletedAt: null,
              },
            }),
            tx.employeeAssignment.count({
              where: {
                departmentId: department.id,
                companyId,
                endDate: null,
              },
            }),
          ])
          if (activeChildren > 0) {
            throw conflict(
              '하위 부서가 있는 부서는 삭제할 수 없습니다. 먼저 하위 부서를 이동하거나 삭제해 주세요.',
            )
          }
          if (openAssignments > 0) {
            throw conflict(
              '현재 소속 직원이 있는 부서는 삭제할 수 없습니다. 먼저 직원을 다른 부서로 이동해 주세요.',
            )
          }

          const closed = await tx.department.updateMany({
            where: {
              id: department.id,
              companyId,
              parentId: department.parentId,
              deletedAt: null,
            },
            data: { deletedAt: new Date() },
          })
          if (closed.count !== 1) {
            throw conflict('부서가 다른 작업에서 변경되었습니다. 다시 시도해 주세요.')
          }
        } else if (shouldRename && affectedDepartmentId && typeof renameName === 'string') {
          const department = await tx.department.findFirst({
            where: { id: affectedDepartmentId, companyId, deletedAt: null },
            select: { id: true, name: true },
          })
          if (!department) throw notFound('부서를 찾을 수 없습니다.')
          const renamed = await tx.department.updateMany({
            where: {
              id: department.id,
              companyId,
              name: department.name,
              deletedAt: null,
            },
            data: { name: renameName },
          })
          if (renamed.count !== 1) {
            throw conflict('부서가 다른 작업에서 변경되었습니다. 다시 시도해 주세요.')
          }
        } else if (shouldCreate) {
          const parentId =
            typeof toDataRecord.parentId === 'string' ? toDataRecord.parentId : null
          if (parentId) {
            const parent = await tx.department.findFirst({
              where: { id: parentId, companyId, deletedAt: null },
              select: { id: true },
            })
            if (!parent) throw conflict('상위 부서가 변경되었거나 삭제되었습니다.')
          }
          await tx.department.create({
            data: {
              companyId,
              code: toDataRecord.code as string,
              name: toDataRecord.name as string,
              level: toDataRecord.level as number,
              nameEn: typeof toDataRecord.nameEn === 'string' ? toDataRecord.nameEn : null,
              parentId,
              sortOrder:
                typeof toDataRecord.sortOrder === 'number' ? toDataRecord.sortOrder : 0,
            },
          })
        }
        // MERGE, SPLIT, RESTRUCTURE: history record only — no automated side effects

        const history = await tx.orgChangeHistory.create({
          data: {
            companyId,
            changeType,
            effectiveDate: new Date(effectiveDate),
            affectedDepartmentId: affectedDepartmentId ?? null,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            fromData: fromData ? (JSON.parse(JSON.stringify(fromData)) as any) : undefined,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            toData: toData ? (JSON.parse(JSON.stringify(toData)) as any) : undefined,
            reason: reason ?? null,
            approvedById: approvedById ?? null,
            documentKey: documentKey ?? null,
          },
        })

        return history
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'org.restructure',
        resourceType: 'org',
        resourceId: record.id,
        companyId: record.companyId,
        ip,
        userAgent,
      })

      return apiSuccess(record, 201)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.ORG, ACTION.UPDATE),
)
