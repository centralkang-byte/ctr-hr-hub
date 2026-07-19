import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, notFound, forbidden, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import {
  employeePayItemListSchema,
  employeePayItemCreateSchema,
} from '@/lib/schemas/payroll'
import { parseDateOnly } from '@/lib/timezone'
import {
  acquirePrimaryAssignmentEmployeeLocks,
  getPrimaryAssignmentAtDate,
  readPrimaryAssignmentTimeline,
  withPrimaryAssignmentRetry,
} from '@/lib/employee/primary-assignment-writer'
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
          ? { assignments: { some: { companyId, isPrimary: true } } }
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

    const effectiveFrom = parseDateOnly(parsed.data.effectiveFrom)
    const effectiveTo = parsed.data.effectiveTo
      ? parseDateOnly(parsed.data.effectiveTo)
      : null
    if (effectiveTo && effectiveTo < effectiveFrom) {
      throw badRequest('적용 종료일은 시작일보다 빠를 수 없습니다.')
    }

    try {
      const result = await withPrimaryAssignmentRetry(() =>
        prisma.$transaction(async (tx) => {
          // Serialize the ownership decision with every S345 assignment writer.
          await acquirePrimaryAssignmentEmployeeLocks(tx, [employeeId])
          const employee = await tx.employee.findUnique({
            where: { id: employeeId },
            select: { id: true },
          })
          if (!employee) throw notFound('직원을 찾을 수 없습니다.')

          const timeline = await readPrimaryAssignmentTimeline(tx, employeeId)
          const assignment = getPrimaryAssignmentAtDate(timeline, effectiveFrom)
          if (!assignment) {
            throw badRequest('적용 시작일에 유효한 주 발령을 찾을 수 없습니다.')
          }
          if (
            assignment.endDate !== null &&
            (effectiveTo === null || effectiveTo >= assignment.endDate)
          ) {
            throw badRequest('급여 항목 적용 기간은 하나의 법인 발령 기간 안에 있어야 합니다.')
          }
          if (user.role !== 'SUPER_ADMIN' && assignment.companyId !== user.companyId) {
            throw forbidden('다른 법인 소속 급여 항목을 등록할 수 없습니다.')
          }

          const [allowanceType, deductionType] = await Promise.all([
            parsed.data.allowanceTypeId
              ? tx.payAllowanceType.findFirst({
                  where: {
                    id: parsed.data.allowanceTypeId,
                    companyId: assignment.companyId,
                    isActive: true,
                    deletedAt: null,
                  },
                  select: { id: true },
                })
              : null,
            parsed.data.deductionTypeId
              ? tx.payDeductionType.findFirst({
                  where: {
                    id: parsed.data.deductionTypeId,
                    companyId: assignment.companyId,
                    deletedAt: null,
                  },
                  select: { id: true },
                })
              : null,
          ])
          if (parsed.data.itemType === 'ALLOWANCE' && !allowanceType) {
            throw badRequest('해당 법인의 유효한 수당 항목이 아닙니다.')
          }
          if (parsed.data.itemType === 'DEDUCTION' && !deductionType) {
            throw badRequest('해당 법인의 유효한 공제 항목이 아닙니다.')
          }

          return tx.employeePayItem.create({
            data: {
              employeeId,
              companyId: assignment.companyId,
              itemType: parsed.data.itemType,
              allowanceTypeId: parsed.data.allowanceTypeId,
              deductionTypeId: parsed.data.deductionTypeId,
              amount: parsed.data.amount,
              currency: parsed.data.currency,
              effectiveFrom,
              effectiveTo,
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
        }),
      )

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
