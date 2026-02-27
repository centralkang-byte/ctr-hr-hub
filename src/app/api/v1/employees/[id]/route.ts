// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET/PUT/DELETE /api/v1/employees/[id]
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound, badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { employeeUpdateSchema } from '@/lib/schemas/employee'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/employees/[id] ───────────────────────────

export const GET = withPermission(
  async (
    _req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id } = await context.params

    const companyFilter = user.role === 'SUPER_ADMIN' ? {} : { companyId: user.companyId }

    const employee = await prisma.employee.findFirst({
      where: { id, deletedAt: null, ...companyFilter },
      include: {
        department: true,
        jobGrade: true,
        jobCategory: true,
        manager: { select: { id: true, name: true, photoUrl: true } },
        employeeHistories: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    })

    if (!employee) {
      throw notFound('직원을 찾을 수 없습니다.')
    }

    return apiSuccess(employee)
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)

// ─── PUT /api/v1/employees/[id] ───────────────────────────

export const PUT = withPermission(
  async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id } = await context.params

    const body: unknown = await req.json()
    const parsed = employeeUpdateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const updateData: Record<string, unknown> = { ...parsed.data }
    if (parsed.data.hireDate) updateData.hireDate = new Date(parsed.data.hireDate)
    if (parsed.data.birthDate) updateData.birthDate = new Date(parsed.data.birthDate)
    if (parsed.data.resignDate) updateData.resignDate = new Date(parsed.data.resignDate)

    const companyFilter = user.role === 'SUPER_ADMIN' ? {} : { companyId: user.companyId }

    try {
      const employee = await prisma.employee.update({
        where: { id, ...companyFilter },
        data: updateData,
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'employee.update',
        resourceType: 'employee',
        resourceId: employee.id,
        companyId: employee.companyId,
        ip,
        userAgent,
      })

      return apiSuccess(employee)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.EMPLOYEES, ACTION.UPDATE),
)

// ─── DELETE /api/v1/employees/[id] (soft delete) ─────────

export const DELETE = withPermission(
  async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id } = await context.params

    const companyFilter = user.role === 'SUPER_ADMIN' ? {} : { companyId: user.companyId }

    try {
      const employee = await prisma.employee.update({
        where: { id, deletedAt: null, ...companyFilter },
        data: { deletedAt: new Date() },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'employee.delete',
        resourceType: 'employee',
        resourceId: id,
        companyId: employee.companyId,
        ip,
        userAgent,
      })

      return apiSuccess({ id })
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.EMPLOYEES, ACTION.DELETE),
)
