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

    const assignmentFilter =
      user.role === 'SUPER_ADMIN'
        ? {}
        : { assignments: { some: { companyId: user.companyId, isPrimary: true, endDate: null } } }

    const employee = await prisma.employee.findFirst({
      where: { id, deletedAt: null, ...assignmentFilter },
      include: {
        assignments: {
          where: { isPrimary: true, endDate: null },
          take: 1,
          include: {
            department: true,
            jobGrade: true,
            jobCategory: true,
            company: true,
          },
        },
        employeeHistories: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    })

    if (!employee) {
      throw notFound('직원을 찾을 수 없습니다.')
    }

    // Flatten assignments[0] into top-level fields for frontend compatibility
    // EmployeeDetail expects { department, jobGrade, jobCategory, status, employmentType } at root level
    const a = employee.assignments?.[0]
    const mappedEmployee = {
      ...employee,
      department: a?.department ?? null,
      jobGrade: a?.jobGrade ?? null,
      jobCategory: a?.jobCategory ?? null,
      employmentType: a?.employmentType ?? null,
      status: a?.status ?? 'ACTIVE',
    }

    return apiSuccess(mappedEmployee)
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

    // Strip fields that now live on EmployeeAssignment (moved in A2-1)
    const {
      companyId: _companyId,
      departmentId: _departmentId,
      jobGradeId: _jobGradeId,
      jobCategoryId: _jobCategoryId,
      employmentType: _employmentType,
      status: _status,
      managerId: _managerId,
      ...employeeOnlyFields
    } = parsed.data

    const updateData: Record<string, unknown> = { ...employeeOnlyFields }
    if (parsed.data.hireDate) updateData.hireDate = new Date(parsed.data.hireDate)
    if (parsed.data.birthDate) updateData.birthDate = new Date(parsed.data.birthDate)
    if (parsed.data.resignDate) updateData.resignDate = new Date(parsed.data.resignDate)

    try {
      // For non-SUPER_ADMIN, first verify the employee belongs to user's company via assignment
      if (user.role !== 'SUPER_ADMIN') {
        const exists = await prisma.employee.findFirst({
          where: {
            id,
            deletedAt: null,
            assignments: { some: { companyId: user.companyId, isPrimary: true, endDate: null } },
          },
          select: { id: true },
        })
        if (!exists) {
          throw notFound('직원을 찾을 수 없습니다.')
        }
      }

      const employee = await prisma.employee.update({
        where: { id },
        data: updateData,
        include: {
          assignments: {
            where: { isPrimary: true, endDate: null },
            take: 1,
            select: { companyId: true },
          },
        },
      })

      const employeeCompanyId = (employee.assignments[0]?.companyId as string | undefined) ?? ''

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'employee.update',
        resourceType: 'employee',
        resourceId: employee.id,
        companyId: employeeCompanyId,
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

    try {
      // For non-SUPER_ADMIN, verify the employee belongs to user's company via assignment
      if (user.role !== 'SUPER_ADMIN') {
        const exists = await prisma.employee.findFirst({
          where: {
            id,
            deletedAt: null,
            assignments: { some: { companyId: user.companyId, isPrimary: true, endDate: null } },
          },
          select: { id: true },
        })
        if (!exists) {
          const { notFound: throwNotFound } = await import('@/lib/errors')
          throw throwNotFound('직원을 찾을 수 없습니다.')
        }
      }

      const employee = await prisma.employee.update({
        where: { id, deletedAt: null },
        data: { deletedAt: new Date() },
        include: {
          assignments: {
            where: { isPrimary: true, endDate: null },
            take: 1,
            select: { companyId: true },
          },
        },
      })

      const employeeCompanyId = (employee.assignments[0]?.companyId as string | undefined) ?? ''

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'employee.delete',
        resourceType: 'employee',
        resourceId: id,
        companyId: employeeCompanyId,
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
