// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET / PUT / DELETE /api/v1/org/departments/[id]
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, conflict, notFound, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import {
  acquirePrimaryAssignmentDepartmentLocks,
  revalidatePrimaryAssignmentDepartments,
} from '@/lib/employee/primary-assignment-writer'
import { softDeleteDepartment } from '@/lib/org/department-lifecycle'
import { departmentUpdateSchema } from '@/lib/schemas/org'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/org/departments/[id] ─────────────────────

export const GET = withPermission(
  async (
    _req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id } = await context.params

    const companyFilter =
      user.role === 'SUPER_ADMIN' ? {} : { companyId: user.companyId }

    const department = await prisma.department.findFirst({
      where: { id, deletedAt: null, ...companyFilter },
    })
    if (!department) throw notFound('부서를 찾을 수 없습니다.')

    // Multi-tenant scope: parent/children always constrained to the same company
    // as the fetched department (defensive — even SUPER_ADMIN sees same-company tree).
    const [parent, children] = await Promise.all([
      department.parentId
        ? prisma.department.findFirst({
            where: {
              id: department.parentId,
              companyId: department.companyId,
              deletedAt: null,
            },
            select: { id: true, name: true },
          })
        : Promise.resolve(null),
      prisma.department.findMany({
        where: {
          parentId: department.id,
          companyId: department.companyId,
          deletedAt: null,
        },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ])

    return apiSuccess({ ...department, parent, children })
  },
  perm(MODULE.ORG, ACTION.VIEW),
)

// ─── PUT /api/v1/org/departments/[id] ─────────────────────

export const PUT = withPermission(
  async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id } = await context.params

    const body: unknown = await req.json()
    const parsed = departmentUpdateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const companyFilter =
      user.role === 'SUPER_ADMIN' ? {} : { companyId: user.companyId }

    // Pre-check: verify department exists within the user's company scope
    const existing = await prisma.department.findFirst({
      where: { id, deletedAt: null, ...companyFilter },
      select: { id: true, companyId: true, parentId: true },
    })
    if (!existing) throw notFound('부서를 찾을 수 없습니다.')

    try {
      const nextParentId = parsed.data.parentId === undefined
        ? existing.parentId
        : parsed.data.parentId
      const department = await prisma.$transaction(async (tx) => {
        const scopes = [
          { companyId: existing.companyId, departmentId: existing.id },
          { companyId: existing.companyId, departmentId: existing.parentId },
          { companyId: existing.companyId, departmentId: nextParentId ?? null },
        ]
        await acquirePrimaryAssignmentDepartmentLocks(tx, scopes)
        await revalidatePrimaryAssignmentDepartments(tx, scopes)

        const locked = await tx.department.findFirst({
          where: {
            id: existing.id,
            companyId: existing.companyId,
            deletedAt: null,
          },
          select: { id: true, parentId: true },
        })
        if (!locked) throw notFound('부서를 찾을 수 없습니다.')
        if (locked.parentId !== existing.parentId) {
          throw conflict('부서 소속이 변경되었습니다. 다시 시도해 주세요.')
        }

        const updated = await tx.department.updateMany({
          where: {
            id,
            companyId: existing.companyId,
            parentId: locked.parentId,
            deletedAt: null,
          },
          data: parsed.data,
        })
        if (updated.count !== 1) {
          throw conflict('부서가 다른 작업에서 변경되었습니다. 다시 시도해 주세요.')
        }
        return tx.department.findUniqueOrThrow({ where: { id } })
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'org.department.update',
        resourceType: 'department',
        resourceId: id,
        companyId: existing.companyId,
        ip,
        userAgent,
      })

      return apiSuccess(department)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.ORG, ACTION.UPDATE),
)

// ─── DELETE /api/v1/org/departments/[id] (soft delete) ────

export const DELETE = withPermission(
  async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id } = await context.params

    const companyFilter =
      user.role === 'SUPER_ADMIN' ? {} : { companyId: user.companyId }

    const existing = await prisma.department.findFirst({
      where: { id, deletedAt: null, ...companyFilter },
      select: { id: true, companyId: true, parentId: true },
    })
    if (!existing) throw notFound('부서를 찾을 수 없습니다.')

    try {
      await softDeleteDepartment({
        id: existing.id,
        companyId: existing.companyId,
        expectedParentId: existing.parentId,
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'org.department.delete',
        resourceType: 'department',
        resourceId: id,
        companyId: existing.companyId,
        ip,
        userAgent,
      })

      return apiSuccess({ id, deleted: true })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.ORG, ACTION.DELETE),
)
