// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/employees  +  POST /api/v1/employees
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import {
  employeeSearchSchema,
  employeeCreateSchema,
} from '@/lib/schemas/employee'
import { createAssignment } from '@/lib/assignments'
import { eventBus, DOMAIN_EVENTS } from '@/lib/events'
import { maskSensitiveFields } from '@/lib/masking'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/employees ────────────────────────────────

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = employeeSearchSchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const {
      page,
      limit,
      companyId,
      departmentId,
      jobGradeId,
      jobCategoryId,
      status,
      employmentType,
      search,
      contractType,
      hireDateFrom,
      hireDateTo,
    } = parsed.data

    // Company scope: SUPER_ADMIN sees all, others only their company
    // Build the assignments filter for company scope + optional field filters
    const assignmentScopeFilter: Record<string, unknown> = {}
    if (user.role !== 'SUPER_ADMIN') {
      assignmentScopeFilter.companyId = user.companyId
    } else if (companyId) {
      assignmentScopeFilter.companyId = companyId
    }
    if (departmentId) assignmentScopeFilter.departmentId = departmentId
    if (jobGradeId) assignmentScopeFilter.jobGradeId = jobGradeId
    if (jobCategoryId) assignmentScopeFilter.jobCategoryId = jobCategoryId
    if (status) assignmentScopeFilter.status = status
    if (employmentType) assignmentScopeFilter.employmentType = employmentType
    if (contractType) assignmentScopeFilter.contractType = contractType

    const hasAssignmentFilter = Object.keys(assignmentScopeFilter).length > 0

    const hireDateFilter: Record<string, unknown> = {}
    if (hireDateFrom) hireDateFilter.gte = new Date(hireDateFrom)
    if (hireDateTo) hireDateFilter.lte = new Date(hireDateTo)

    const where = {
      deletedAt: null,
      ...(Object.keys(hireDateFilter).length > 0 ? { hireDate: hireDateFilter } : {}),
      ...(hasAssignmentFilter
        ? {
            assignments: {
              some: {
                ...assignmentScopeFilter,
                isPrimary: true,
                endDate: null,
              },
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { nameEn: { contains: search, mode: 'insensitive' as const } },
              { employeeNo: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    }

    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        select: {
          id: true,
          name: true,
          nameEn: true,
          email: true,
          phone: true,
          employeeNo: true,
          hireDate: true,
          assignments: {
            where: { isPrimary: true, endDate: null },
            take: 1,
            select: {
              companyId: true,
              status: true,
              employmentType: true,
              department: { select: { id: true, name: true } },
              jobGrade: { select: { id: true, name: true } },
              title: { select: { id: true, name: true } },
              jobCategory: { select: { id: true, name: true } },
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      prisma.employee.count({ where }),
    ])

    // Flatten primary assignment into top-level fields for frontend compatibility
    // EmployeeRow expects { department, jobGrade, jobCategory } at root level
    const mapped = employees.map((emp) => {
      const a = extractPrimaryAssignment(emp.assignments)
      return {
        ...emp,
        department: a?.department ?? null,
        jobGrade: a?.jobGrade ?? null,
        title: a?.title ?? null,
        jobCategory: a?.jobCategory ?? null,
        employmentType: a?.employmentType ?? null,
        status: a?.status ?? 'ACTIVE',
      }
    })

    // PII masking: non-HR roles get phone/email masked; residentId is never selected
    const isPrivileged = user.role === ROLE.SUPER_ADMIN || user.role === ROLE.HR_ADMIN
    const sanitized = isPrivileged
      ? mapped
      : maskSensitiveFields(mapped, user.role, user.employeeId ?? undefined)

    return apiPaginated(sanitized, buildPagination(page, limit, total))
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)

// ─── POST /api/v1/employees ───────────────────────────────

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = employeeCreateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    try {
      // Extract assignment fields (removed from Employee model in A2-1)
      const {
        companyId: empCompanyId,
        departmentId,
        jobGradeId,
        titleId,
        jobCategoryId,
        employmentType,
        status,
        managerId: _managerId, // managerId removed from Employee; ignored here
        ...employeeFields
      } = parsed.data

      const employee = await prisma.employee.create({
        data: {
          ...employeeFields,
          hireDate: new Date(parsed.data.hireDate),
          birthDate: parsed.data.birthDate ? new Date(parsed.data.birthDate) : null,
          resignDate: parsed.data.resignDate ? new Date(parsed.data.resignDate) : null,
        },
      })

      // Create the initial assignment with the assignment-scoped fields
      await createAssignment({
        employeeId: employee.id,
        effectiveDate: employee.hireDate,
        changeType: 'HIRE',
        companyId: empCompanyId,
        departmentId,
        jobGradeId,
        titleId: titleId ?? undefined,
        jobCategoryId,
        employmentType,
        status,
        isPrimary: true,
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'employee.create',
        resourceType: 'employee',
        resourceId: employee.id,
        companyId: empCompanyId,
        ip,
        userAgent,
      })

      // Fire-and-forget: EMPLOYEE_HIRED → Session B handler
      // (EmployeeOnboarding + tasks 자동 생성은 handler에서 처리)
      void eventBus.publish(DOMAIN_EVENTS.EMPLOYEE_HIRED, {
        ctx: {
          companyId: empCompanyId,
          actorId:   user.employeeId,
          occurredAt: new Date(),
        },
        employeeId:   employee.id,
        companyId:    empCompanyId,
        hireDate:     employee.hireDate,
        departmentId: departmentId ?? undefined,
        positionId:   jobGradeId   ?? undefined,
      })

      return apiSuccess(employee, 201)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.EMPLOYEES, ACTION.CREATE),
)
