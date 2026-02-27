// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET/POST /api/v1/employees/[id]/contracts
// ═══════════════════════════════════════════════════════════
// NOTE: ContractHistory model was added in STEP 2.5.
// Run `prisma generate` to update the generated client.
// Until then, we cast the prisma client to access new models.

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiPaginated, apiSuccess, buildPagination } from '@/lib/api'
import { notFound, badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { paginationSchema } from '@/lib/schemas/common'
import type { SessionUser } from '@/types'
// PrismaClient type not used directly — models accessed via cast

// ─── Temporary types until prisma generate ────────────────

type ContractType = 'PERMANENT' | 'FIXED_TERM' | 'DISPATCH' | 'INTERN' | 'PROBATION_ONLY'

interface ContractHistoryCreateInput {
  employeeId: string
  companyId: string
  contractNumber: number
  contractType: ContractType
  startDate: Date
  endDate?: Date | null
  salaryAmount?: number | null
  termsDocumentKey?: string | null
  notes?: string | null
}

interface ContractHistoryWhereInput {
  id?: string
  employeeId?: string
}

interface ContractHistoryDelegate {
  findMany(args: {
    where: ContractHistoryWhereInput
    orderBy: object | object[]
    skip: number
    take: number
    include?: object
  }): Promise<ContractHistoryRecord[]>
  count(args: { where: ContractHistoryWhereInput }): Promise<number>
  create(args: { data: ContractHistoryCreateInput }): Promise<ContractHistoryRecord>
}

interface ContractHistoryRecord {
  id: string
  employeeId: string
  companyId: string
  contractNumber: number
  contractType: ContractType
  startDate: Date
  endDate: Date | null
  salaryAmount: unknown
  termsDocumentKey: string | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
  signer?: { id: string; name: string } | null
}

interface ExtendedEmployee {
  id: string
  companyId: string
  contractNumber: number
}

interface ExtendedPrismaClient {
  contractHistory: ContractHistoryDelegate
  employee: {
    findFirst(args: object): Promise<ExtendedEmployee | null>
    update(args: object): Promise<ExtendedEmployee>
  }
  $transaction(ops: unknown[]): Promise<unknown[]>
}

const db = prisma as unknown as ExtendedPrismaClient

// ─── Schemas ──────────────────────────────────────────────

const contractCreateSchema = z.object({
  contractType: z.enum(['PERMANENT', 'FIXED_TERM', 'DISPATCH', 'INTERN', 'PROBATION_ONLY']),
  startDate: z.string().date(),
  endDate: z.string().date().optional(),
  salaryAmount: z.number().positive().optional(),
  termsDocumentKey: z.string().optional(),
  notes: z.string().optional(),
})

// ─── GET /api/v1/employees/[id]/contracts ─────────────────

export const GET = withPermission(
  async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id } = await context.params

    const companyFilter = user.role === 'SUPER_ADMIN' ? {} : { companyId: user.companyId }

    const employee = await prisma.employee.findFirst({
      where: { id, deletedAt: null, ...companyFilter },
      select: { id: true },
    })
    if (!employee) throw notFound('직원을 찾을 수 없습니다.')

    const rawParams = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = paginationSchema.safeParse(rawParams)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { page, limit } = parsed.data

    const [contracts, total] = await Promise.all([
      db.contractHistory.findMany({
        where: { employeeId: id },
        orderBy: [{ contractNumber: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          signer: { select: { id: true, name: true } },
        },
      }),
      db.contractHistory.count({ where: { employeeId: id } }),
    ])

    return apiPaginated(contracts, buildPagination(page, limit, total))
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)

// ─── POST /api/v1/employees/[id]/contracts ────────────────

export const POST = withPermission(
  async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id } = await context.params

    const companyFilter = user.role === 'SUPER_ADMIN' ? {} : { companyId: user.companyId }

    const employee = await db.employee.findFirst({
      where: { id, deletedAt: null, ...companyFilter },
      select: { id: true, companyId: true, contractNumber: true },
    })
    if (!employee) throw notFound('직원을 찾을 수 없습니다.')

    const body: unknown = await req.json()
    const parsed = contractCreateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const {
      contractType,
      startDate,
      endDate,
      salaryAmount,
      termsDocumentKey,
      notes,
    } = parsed.data

    const nextContractNumber = employee.contractNumber + 1

    try {
      const results = await prisma.$transaction([
        db.contractHistory.create({
          data: {
            employeeId: id,
            companyId: employee.companyId,
            contractNumber: nextContractNumber,
            contractType,
            startDate: new Date(startDate),
            endDate: endDate ? new Date(endDate) : null,
            salaryAmount: salaryAmount ?? null,
            termsDocumentKey: termsDocumentKey ?? null,
            notes: notes ?? null,
          },
        }) as unknown as Parameters<typeof prisma.$transaction>[0] extends (infer T)[] ? T : never,
        prisma.employee.update({
          where: { id },
          data: {},
        }),
      ])

      const contract = (results as ContractHistoryRecord[])[0]

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'contract.create',
        resourceType: 'contractHistory',
        resourceId: contract.id,
        companyId: employee.companyId,
        ip,
        userAgent,
      })

      return apiSuccess(contract, 201)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.EMPLOYEES, ACTION.CREATE),
)
