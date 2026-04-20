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
      select: { id: true, companyId: true },
    })
    if (!existing) throw notFound('부서를 찾을 수 없습니다.')

    try {
      const department = await prisma.department.update({
        where: { id, companyId: existing.companyId },
        data: parsed.data,
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
      select: { id: true, companyId: true },
    })
    if (!existing) throw notFound('부서를 찾을 수 없습니다.')

    // 하위 부서/현행 배정이 살아있으면 삭제 차단 (cascade/orphan 방지)
    const [activeChildren, activeAssignments] = await Promise.all([
      prisma.department.count({ where: { parentId: id, deletedAt: null } }),
      prisma.employeeAssignment.count({ where: { departmentId: id, endDate: null } }),
    ])
    if (activeChildren > 0) {
      throw conflict('하위 부서가 있는 부서는 삭제할 수 없습니다. 먼저 하위 부서를 이동하거나 삭제해 주세요.')
    }
    if (activeAssignments > 0) {
      throw conflict('현재 소속 직원이 있는 부서는 삭제할 수 없습니다. 먼저 직원을 다른 부서로 이동해 주세요.')
    }

    try {
      await prisma.department.update({
        where: { id, companyId: existing.companyId },
        data: { deletedAt: new Date() },
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
