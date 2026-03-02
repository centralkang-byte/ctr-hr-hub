// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/entity-transfers + POST /api/v1/entity-transfers
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, notFound, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import {
  entityTransferListSchema,
  entityTransferCreateSchema,
} from '@/lib/schemas/entity-transfer'
import type { SessionUser } from '@/types'

// ─── Data log types to create on transfer request ────────
const INITIAL_DATA_LOG_TYPES = [
  'HR_MASTER',
  'PAYROLL',
  'LEAVE',
  'PERFORMANCE',
  'TENURE',
] as const

// ─── GET /api/v1/entity-transfers ────────────────────────

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = entityTransferListSchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { page, limit, status, fromCompanyId, toCompanyId, employeeId } =
      parsed.data

    // Company scope: SUPER_ADMIN sees all; HR_ADMIN sees their company (from or to)
    const companyFilter =
      user.role === 'SUPER_ADMIN'
        ? {}
        : {
            OR: [
              { fromCompanyId: user.companyId },
              { toCompanyId: user.companyId },
            ],
          }

    const where = {
      ...companyFilter,
      ...(status ? { status } : {}),
      ...(fromCompanyId ? { fromCompanyId } : {}),
      ...(toCompanyId ? { toCompanyId } : {}),
      ...(employeeId ? { employeeId } : {}),
    }

    const [transfers, total] = await Promise.all([
      prisma.entityTransfer.findMany({
        where,
        include: {
          employee: { select: { id: true, name: true, employeeNo: true } },
          fromCompany: { select: { id: true, name: true } },
          toCompany: { select: { id: true, name: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.entityTransfer.count({ where }),
    ])

    return apiPaginated(transfers, buildPagination(page, limit, total))
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)

// ─── POST /api/v1/entity-transfers ───────────────────────

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = entityTransferCreateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const {
      employeeId,
      toCompanyId,
      transferType,
      transferDate,
      returnDate,
      newDepartmentId,
      newJobGradeId,
      newEmployeeNo,
      dataOptions,
    } = parsed.data

    // Look up employee to get current companyId
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        assignments: {
          where: { isPrimary: true, endDate: null },
          take: 1,
          select: { companyId: true },
        },
      },
    })

    if (!employee) {
      throw notFound('직원을 찾을 수 없습니다.')
    }

    const employeeCompanyId = (employee.assignments[0] as any)?.companyId as string | undefined // eslint-disable-line @typescript-eslint/no-explicit-any

    if (employeeCompanyId === toCompanyId) {
      throw badRequest('이전 대상 법인이 현재 법인과 동일합니다.')
    }

    try {
      const transfer = await prisma.$transaction(async (tx) => {
        // Create the transfer request
        const created = await tx.entityTransfer.create({
          data: {
            employeeId,
            fromCompanyId: employeeCompanyId ?? '',
            toCompanyId,
            transferType,
            transferDate: new Date(transferDate),
            returnDate: returnDate ? new Date(returnDate) : null,
            status: 'TRANSFER_REQUESTED',
            dataOptions: dataOptions ?? undefined,
            newDepartmentId: newDepartmentId ?? null,
            newJobGradeId: newJobGradeId ?? null,
            newEmployeeNo: newEmployeeNo ?? null,
            requestedBy: user.employeeId,
          },
        })

        // Create initial data logs (all DATA_PENDING)
        await tx.entityTransferDataLog.createMany({
          data: INITIAL_DATA_LOG_TYPES.map((dataType) => ({
            transferId: created.id,
            dataType,
            status: 'DATA_PENDING' as const,
          })),
        })

        // Return with relations
        return tx.entityTransfer.findUnique({
          where: { id: created.id },
          include: {
            employee: { select: { id: true, name: true, employeeNo: true } },
            fromCompany: { select: { id: true, name: true } },
            toCompany: { select: { id: true, name: true } },
            dataLogs: true,
          },
        })
      })

      return apiSuccess(transfer, 201)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.EMPLOYEES, ACTION.CREATE),
)
