import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, notFound, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import {
  employeePayItemListSchema,
  employeePayItemCreateSchema,
} from '@/lib/schemas/payroll'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/payroll/employees/[id]/pay-items ────────
// List all pay items (allowances + deductions) for an employee

export const GET = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id: employeeId } = await context.params
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = employeePayItemListSchema.safeParse({ ...params, employeeId })
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { page, limit, itemType } = parsed.data
    const companyId = user.role === 'SUPER_ADMIN' ? undefined : user.companyId
    const payItemCompanyFilter = companyId ? { companyId } : {}

    // Verify employee exists and belongs to user's company
    const employee = await prisma.employee.findFirst({
      where: {
        id: employeeId,
        ...(companyId
          ? { assignments: { some: { companyId, isPrimary: true, endDate: null } } }
          : {}),
      },
      select: { id: true },
    })
    if (!employee) throw notFound('직원을 찾을 수 없습니다.')

    const where = {
      employeeId,
      ...payItemCompanyFilter,
      ...(itemType ? { itemType } : {}),
    }

    const [items, total] = await Promise.all([
      prisma.employeePayItem.findMany({
        where,
        include: {
          allowanceType: {
            select: { id: true, code: true, name: true, category: true },
          },
          deductionType: {
            select: { id: true, code: true, name: true, category: true },
          },
        },
        orderBy: [{ itemType: 'asc' }, { effectiveFrom: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.employeePayItem.count({ where }),
    ])

    return apiPaginated(items, buildPagination(page, limit, total))
  },
  perm(MODULE.PAYROLL, ACTION.VIEW),
)

// ─── POST /api/v1/payroll/employees/[id]/pay-items ───────
// Create a new pay item for the employee

export const POST = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id: employeeId } = await context.params
    const body: unknown = await req.json()

    // Override employeeId from URL params
    const parsed = employeePayItemCreateSchema.safeParse({
      ...(body as Record<string, unknown>),
      employeeId,
    })
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const postCompanyId = user.role === 'SUPER_ADMIN' ? undefined : user.companyId

    // Verify employee exists and belongs to user's company
    const employee = await prisma.employee.findFirst({
      where: {
        id: employeeId,
        ...(postCompanyId
          ? { assignments: { some: { companyId: postCompanyId, isPrimary: true, endDate: null } } }
          : {}),
      },
      select: {
        id: true,
        assignments: {
          where: { isPrimary: true, endDate: null },
          take: 1,
          select: { companyId: true },
        },
      },
    })
    if (!employee) throw notFound('직원을 찾을 수 없습니다.')
    const empCompanyId = extractPrimaryAssignment(employee.assignments ?? [])?.companyId ?? user.companyId

    try {
      const result = await prisma.employeePayItem.create({
        data: {
          employeeId,
          companyId: empCompanyId,
          itemType: parsed.data.itemType,
          allowanceTypeId: parsed.data.allowanceTypeId,
          deductionTypeId: parsed.data.deductionTypeId,
          amount: parsed.data.amount,
          currency: parsed.data.currency,
          effectiveFrom: new Date(parsed.data.effectiveFrom),
          effectiveTo: parsed.data.effectiveTo ? new Date(parsed.data.effectiveTo) : null,
          note: parsed.data.note,
        },
        include: {
          allowanceType: {
            select: { id: true, code: true, name: true, category: true },
          },
          deductionType: {
            select: { id: true, code: true, name: true, category: true },
          },
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'payroll.employee-pay-item.create',
        resourceType: 'employeePayItem',
        resourceId: result.id,
        companyId: result.companyId,
        ip,
        userAgent,
        changes: { targetEmployeeId: employeeId, itemType: parsed.data.itemType },
      })

      return apiSuccess(result, 201)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.PAYROLL, ACTION.CREATE),
)
