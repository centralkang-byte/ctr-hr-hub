// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET/PUT /api/v1/employees/[id]/contracts/[contractId]
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound, badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── Temporary types until prisma generate ────────────────

interface ContractHistoryDelegate {
  findFirst(args: object): Promise<ContractHistoryRecord | null>
  update(args: object): Promise<ContractHistoryRecord>
}

interface ContractHistoryRecord {
  id: string
  employeeId: string
  companyId: string
  contractNumber: number
  contractType: string
  startDate: Date
  endDate: Date | null
  probationEndDate: Date | null
  salaryAmount: unknown
  termsDocumentKey: string | null
  signedAt: Date | null
  notes: string | null
  autoConvertTriggered: boolean
  createdAt: Date
  updatedAt: Date
}

interface ExtendedPrismaClient {
  contractHistory: ContractHistoryDelegate
}

const db = prisma as unknown as ExtendedPrismaClient

// ─── Schema ───────────────────────────────────────────────

const contractUpdateSchema = z.object({
  contractType: z.enum(['PERMANENT', 'FIXED_TERM', 'DISPATCH', 'INTERN', 'PROBATION_ONLY']).optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().nullable().optional(),
  probationEndDate: z.string().date().nullable().optional(),
  salaryAmount: z.number().positive().nullable().optional(),
  signedAt: z.string().datetime().nullable().optional(),
  notes: z.string().nullable().optional(),
}).strict()

// ─── Helper ───────────────────────────────────────────────

async function findContract(id: string, contractId: string, user: SessionUser) {
  const companyFilter = user.role === 'SUPER_ADMIN' ? {} : { companyId: user.companyId }

  const employee = await prisma.employee.findFirst({
    where: { id, deletedAt: null, ...companyFilter },
    select: { id: true, companyId: true },
  })
  if (!employee) return null

  const contract = await db.contractHistory.findFirst({
    where: { id: contractId, employeeId: id },
  })
  return contract ? { contract, companyId: employee.companyId } : null
}

// ─── GET /api/v1/employees/[id]/contracts/[contractId] ────

export const GET = withPermission(
  async (
    _req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id, contractId } = await context.params

    const result = await findContract(id, contractId, user)
    if (!result) throw notFound('계약을 찾을 수 없습니다.')

    return apiSuccess(result.contract)
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)

// ─── PUT /api/v1/employees/[id]/contracts/[contractId] ────

export const PUT = withPermission(
  async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id, contractId } = await context.params

    const result = await findContract(id, contractId, user)
    if (!result) throw notFound('계약을 찾을 수 없습니다.')

    const body: unknown = await req.json()
    const parsed = contractUpdateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const updateData: Record<string, unknown> = {}
    if (parsed.data.contractType !== undefined) updateData.contractType = parsed.data.contractType
    if (parsed.data.startDate !== undefined) updateData.startDate = new Date(parsed.data.startDate)
    if (parsed.data.endDate !== undefined) {
      updateData.endDate = parsed.data.endDate ? new Date(parsed.data.endDate) : null
    }
    if (parsed.data.probationEndDate !== undefined) {
      updateData.probationEndDate = parsed.data.probationEndDate
        ? new Date(parsed.data.probationEndDate)
        : null
    }
    if (parsed.data.salaryAmount !== undefined) updateData.salaryAmount = parsed.data.salaryAmount
    if (parsed.data.signedAt !== undefined) {
      updateData.signedAt = parsed.data.signedAt ? new Date(parsed.data.signedAt) : null
    }
    if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes

    try {
      const updated = await db.contractHistory.update({
        where: { id: contractId },
        data: updateData,
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'contract.update',
        resourceType: 'contractHistory',
        resourceId: contractId,
        companyId: result.companyId,
        ip,
        userAgent,
      })

      return apiSuccess(updated)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.EMPLOYEES, ACTION.UPDATE),
)
