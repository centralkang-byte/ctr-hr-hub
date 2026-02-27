// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/employees/[id]/transfer
// ═══════════════════════════════════════════════════════════

import { z } from 'zod'
import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

const transferSchema = z.object({
  changeType: z.enum([
    'TRANSFER',
    'PROMOTION',
    'DEMOTION',
    'RESIGN',
    'TERMINATE',
    'TRANSFER_CROSS_COMPANY',
  ]),
  fromDeptId: z.string().uuid().optional(),
  toDeptId: z.string().uuid().optional(),
  fromGradeId: z.string().uuid().optional(),
  toGradeId: z.string().uuid().optional(),
  fromCompanyId: z.string().uuid().optional(),
  toCompanyId: z.string().uuid().optional(),
  effectiveDate: z.string().date(),
  reason: z.string().optional(),
  approvedBy: z.string().uuid().optional(),
})

// ─── POST /api/v1/employees/[id]/transfer ────────────────

export const POST = withPermission(
  async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id } = await context.params

    const body: unknown = await req.json()
    const parsed = transferSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const {
      changeType,
      fromDeptId,
      toDeptId,
      fromGradeId,
      toGradeId,
      fromCompanyId,
      toCompanyId,
      effectiveDate,
      reason,
      approvedBy,
    } = parsed.data

    const companyFilter = user.role === 'SUPER_ADMIN' ? {} : { companyId: user.companyId }

    // Pre-check: verify employee exists within the user's company scope
    const employee = await prisma.employee.findFirst({
      where: { id, deletedAt: null, ...companyFilter },
      select: { id: true, companyId: true },
    })
    if (!employee) throw notFound('직원을 찾을 수 없습니다.')

    try {
      // Build employee update payload based on provided fields
      const employeeUpdate: Record<string, unknown> = {}
      if (toDeptId) employeeUpdate.departmentId = toDeptId
      if (toGradeId) employeeUpdate.jobGradeId = toGradeId
      if (toCompanyId) employeeUpdate.companyId = toCompanyId

      // Status transitions based on changeType
      if (changeType === 'RESIGN') {
        employeeUpdate.status = 'RESIGNED'
      } else if (changeType === 'TERMINATE') {
        employeeUpdate.status = 'TERMINATED'
      }

      // Create history record and optionally update employee in a transaction
      const history = await prisma.$transaction(async (tx) => {
        const record = await tx.employeeHistory.create({
          data: {
            employeeId: id,
            changeType,
            fromDeptId: fromDeptId ?? null,
            toDeptId: toDeptId ?? null,
            fromGradeId: fromGradeId ?? null,
            toGradeId: toGradeId ?? null,
            fromCompanyId: fromCompanyId ?? null,
            toCompanyId: toCompanyId ?? null,
            effectiveDate: new Date(effectiveDate),
            reason: reason ?? null,
            approvedBy: approvedBy ?? null,
          },
        })

        if (Object.keys(employeeUpdate).length > 0) {
          await tx.employee.update({
            where: { id, ...companyFilter },
            data: employeeUpdate,
          })
        }

        return record
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'employee.transfer',
        resourceType: 'employee',
        resourceId: id,
        companyId: employee.companyId,
        ip,
        userAgent,
      })

      return apiSuccess(history, 201)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.EMPLOYEES, ACTION.UPDATE),
)
