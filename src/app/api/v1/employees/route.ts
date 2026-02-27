// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/employees  +  POST /api/v1/employees
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import {
  employeeSearchSchema,
  employeeCreateSchema,
} from '@/lib/schemas/employee'
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
    } = parsed.data

    // Company scope: SUPER_ADMIN sees all, others only their company
    const companyFilter =
      user.role === 'SUPER_ADMIN'
        ? companyId
          ? { companyId }
          : {}
        : { companyId: user.companyId }

    const where = {
      deletedAt: null,
      ...companyFilter,
      ...(departmentId ? { departmentId } : {}),
      ...(jobGradeId ? { jobGradeId } : {}),
      ...(jobCategoryId ? { jobCategoryId } : {}),
      ...(status ? { status } : {}),
      ...(employmentType ? { employmentType } : {}),
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
        include: {
          department: { select: { id: true, name: true } },
          jobGrade: { select: { id: true, name: true } },
          jobCategory: { select: { id: true, name: true } },
          manager: { select: { id: true, name: true, photoUrl: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      prisma.employee.count({ where }),
    ])

    return apiPaginated(employees, buildPagination(page, limit, total))
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
      const employee = await prisma.employee.create({
        data: {
          ...parsed.data,
          hireDate: new Date(parsed.data.hireDate),
          birthDate: parsed.data.birthDate ? new Date(parsed.data.birthDate) : null,
          resignDate: parsed.data.resignDate ? new Date(parsed.data.resignDate) : null,
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'employee.create',
        resourceType: 'employee',
        resourceId: employee.id,
        companyId: employee.companyId,
        ip,
        userAgent,
      })

      return apiSuccess(employee, 201)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.EMPLOYEES, ACTION.CREATE),
)
