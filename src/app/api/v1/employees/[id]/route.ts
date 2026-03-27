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
import { withRLS, buildRLSContext } from '@/lib/api/withRLS'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/employees/[id] ───────────────────────────

export const GET = withPermission(
  async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id } = await context.params

    // IDOR guard: EMPLOYEE can only view their own profile
    if (user.role === 'EMPLOYEE' && id !== user.employeeId) {
      throw notFound('직원을 찾을 수 없습니다.')
    }

    // App-level filter kept as redundant safety net (belt AND suspenders)
    const assignmentFilter =
      user.role === 'SUPER_ADMIN'
        ? {}
        : { assignments: { some: { companyId: user.companyId, isPrimary: true, endDate: null } } }

    // RLS: DB-level tenant isolation via SET LOCAL session variables
    const employee = await withRLS(buildRLSContext(user), (tx) =>
      tx.employee.findFirst({
        where: { id, deletedAt: null, ...assignmentFilter },
        include: {
          assignments: {
            where: { isPrimary: true, endDate: null },
            take: 1,
            include: {
              department: { select: { id: true, name: true, code: true } },
              jobGrade: { select: { id: true, name: true, code: true } },
              jobCategory: { select: { id: true, name: true } },
              company: { select: { id: true, name: true, code: true } },
            },
          },
          employeeHistories: {
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: {
              id: true,
              changeType: true,
              effectiveDate: true,
              reason: true,
              createdAt: true,
            },
          },
        },
      }),
    )

    if (!employee) {
      throw notFound('직원을 찾을 수 없습니다.')
    }

    // Flatten primary assignment into top-level fields for frontend compatibility
    // EmployeeDetail expects { department, jobGrade, jobCategory, status, employmentType } at root level
    const a = extractPrimaryAssignment(employee.assignments)
    const mappedEmployee = {
      ...employee,
      department: a?.department ?? null,
      jobGrade: a?.jobGrade ?? null,
      jobCategory: a?.jobCategory ?? null,
      employmentType: a?.employmentType ?? null,
      status: a?.status ?? 'ACTIVE',
    }

    // Fire-and-forget PII access audit (logAudit is already async internally)
    const { ip, userAgent } = extractRequestMeta(req.headers)
    logAudit({
      actorId: user.employeeId,
      action: 'employees.detail.read',
      resourceType: 'Employee',
      resourceId: id,
      companyId: user.companyId,
      sensitivityLevel: 'HIGH',
      ip,
      userAgent,
    })

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
      titleId: _titleId,
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

      const primary = extractPrimaryAssignment(employee.assignments)
      const employeeCompanyId = primary?.companyId ?? ''

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
        throw notFound('직원을 찾을 수 없습니다.')
      }
    }

    // ── Pre-delete dependency check ──────────────────────────
    const [pendingLeaves, activePayrollItems, activeGoals, pendingOnboarding] = await Promise.all([
      prisma.leaveRequest.count({ where: { employeeId: id, status: 'PENDING' } }),
      prisma.payrollItem.count({ where: { employeeId: id, run: { status: { in: ['CALCULATING', 'ADJUSTMENT', 'REVIEW', 'PENDING_APPROVAL'] } } } }),
      prisma.mboGoal.count({ where: { employeeId: id, status: { in: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'] } } }),
      prisma.employeeOnboarding.count({ where: { employeeId: id, completedAt: null } }),
    ])

    const blockers: string[] = []
    if (pendingLeaves > 0) blockers.push(`대기 중 휴가 신청 ${pendingLeaves}건`)
    if (activePayrollItems > 0) blockers.push(`처리 중 급여 항목 ${activePayrollItems}건`)
    if (activeGoals > 0) blockers.push(`활성 목표 ${activeGoals}건`)
    if (pendingOnboarding > 0) blockers.push(`진행 중 온보딩 ${pendingOnboarding}건`)

    if (blockers.length > 0) {
      throw badRequest(`삭제할 수 없습니다: ${blockers.join(', ')}이(가) 존재합니다.`)
    }

    // Fix 4-9: Count historical data for warning (non-blocking)
    const historicalCounts = await Promise.all([
      prisma.leaveRequest.count({ where: { employeeId: id, status: { not: 'PENDING' } } }),
      prisma.performanceReview.count({ where: { employeeId: id } }),
      prisma.payrollItem.count({ where: { employeeId: id } }),
    ])
    const totalHistorical = historicalCounts.reduce((a, b) => a + b, 0)

    try {
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

      const primaryDel = extractPrimaryAssignment(employee.assignments)
      const employeeCompanyId = primaryDel?.companyId ?? ''

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

      return apiSuccess({
        id,
        message: '직원이 비활성화되었습니다.',
        warnings: totalHistorical > 0
          ? [`${totalHistorical}건의 이력 데이터가 보존됩니다 (휴가/평가/급여).`]
          : [],
      })
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.EMPLOYEES, ACTION.DELETE),
)
