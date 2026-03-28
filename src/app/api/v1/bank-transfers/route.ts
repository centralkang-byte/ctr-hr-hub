// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/bank-transfers + POST /api/v1/bank-transfers
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, handlePrismaError, notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import {
  bankTransferBatchCreateSchema,
  bankTransferBatchListSchema,
} from '@/lib/schemas/bank-transfer'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/bank-transfers ──────────────────────────

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = bankTransferBatchListSchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { page, limit, status, bankCode } = parsed.data

    const companyFilter =
      user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

    const where = {
      ...companyFilter,
      ...(status ? { status } : {}),
      ...(bankCode ? { bankCode } : {}),
    }

    const [batches, total] = await Promise.all([
      prisma.bankTransferBatch.findMany({
        where,
        include: {
          _count: { select: { items: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.bankTransferBatch.count({ where }),
    ])

    return apiPaginated(batches, buildPagination(page, limit, total))
  },
  perm(MODULE.PAYROLL, ACTION.VIEW),
)

// ─── POST /api/v1/bank-transfers ─────────────────────────

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = bankTransferBatchCreateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { payrollRunId, bankCode, bankName, format, note } = parsed.data

    try {
      const batch = await prisma.$transaction(async (tx) => {
        // If payrollRunId provided, fetch payroll items to populate BankTransferItems
        let payrollItems: {
          employeeId: string
          netPay: unknown
          employee: {
            id: string
            name: string
            employeeNo: string
          }
        }[] = []

        if (payrollRunId) {
          const payrollRun = await tx.payrollRun.findUnique({
            where: { id: payrollRunId },
            select: { id: true, companyId: true },
          })

          if (!payrollRun) {
            throw notFound('급여 실행을 찾을 수 없습니다.')
          }

          payrollItems = await tx.payrollItem.findMany({
            where: { runId: payrollRunId },
            select: {
              employeeId: true,
              netPay: true,
              employee: {
                select: { id: true, name: true, employeeNo: true },
              },
            },
          })
        }

        // Calculate totals
        const totalAmount = payrollItems.reduce(
          (sum, item) => sum + Number(item.netPay),
          0,
        )
        const totalCount = payrollItems.length

        // Create the batch
        const created = await tx.bankTransferBatch.create({
          data: {
            companyId: user.companyId,
            payrollRunId: payrollRunId ?? null,
            bankCode,
            bankName,
            format,
            status: 'DRAFT',
            totalAmount,
            totalCount,
            note: note ?? null,
            createdById: user.employeeId,
          },
        })

        // Create transfer items from payroll items
        if (payrollItems.length > 0) {
          await tx.bankTransferItem.createMany({
            data: payrollItems.map((item) => ({
              batchId: created.id,
              employeeId: item.employee.id,
              employeeName: item.employee.name,
              employeeNo: item.employee.employeeNo,
              bankCode,
              accountNumber: '000-0000-0000', // Mock: would come from employee bank info
              accountHolder: item.employee.name,
              amount: Number(item.netPay),
              status: 'PENDING' as const,
            })),
          })
        }

        // Return with items count
        return tx.bankTransferBatch.findUnique({
          where: { id: created.id },
          include: {
            _count: { select: { items: true } },
            items: true,
          },
        })
      })

      const meta = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: ACTION.CREATE,
        resourceType: 'BankTransferBatch',
        resourceId: batch!.id,
        companyId: user.companyId,
        changes: { bankCode, bankName, format, payrollRunId },
        ip: meta.ip,
        userAgent: meta.userAgent,
      })

      return apiSuccess(batch, 201)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.PAYROLL, ACTION.CREATE),
)
