// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Severance Interim Payment List & Create
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { severanceInterimSearchSchema, severanceInterimCreateSchema } from '@/lib/schemas/compliance'
import { calculateSeveranceInterim, validateSeveranceEligibility } from '@/lib/compliance/kr'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = severanceInterimSearchSchema.safeParse(params)
    if (!parsed.success) throw badRequest('Invalid parameters', { issues: parsed.error.issues })

    const { page, limit, status, employeeId } = parsed.data
    const where = {
      companyId: user.companyId,
      ...(status ? { status } : {}),
      ...(employeeId ? { employeeId } : {}),
    }

    const [payments, total] = await Promise.all([
      prisma.severanceInterimPayment.findMany({
        where,
        include: {
          employee: { select: { id: true, name: true, employeeNo: true } },
          approvedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.severanceInterimPayment.count({ where }),
    ])

    const serialized = payments.map((p) => ({
      ...p,
      amount: p.amount ? Number(p.amount) : null,
      yearsOfService: p.yearsOfService ? Number(p.yearsOfService) : null,
      avgSalary: p.avgSalary ? Number(p.avgSalary) : null,
    }))

    return apiPaginated(serialized, buildPagination(page, limit, total))
  },
  perm(MODULE.COMPLIANCE, ACTION.VIEW),
)

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = severanceInterimCreateSchema.safeParse(body)
    if (!parsed.success) throw badRequest('Invalid request data', { issues: parsed.error.issues })

    // Calculate severance
    const calculation = await calculateSeveranceInterim(parsed.data.employeeId)
    if (!calculation) throw badRequest('Employee not found')
    if (!calculation.eligible) throw badRequest(calculation.reason ?? 'Not eligible')

    const eligibility = validateSeveranceEligibility(calculation.yearsOfService)
    if (!eligibility.eligible) throw badRequest(eligibility.reason ?? 'Not eligible')

    try {
      const payment = await prisma.severanceInterimPayment.create({
        data: {
          companyId: user.companyId,
          employeeId: parsed.data.employeeId,
          reason: parsed.data.reason,
          requestDate: new Date(parsed.data.requestDate),
          amount: 'estimatedAmount' in calculation ? calculation.estimatedAmount : undefined,
          yearsOfService: calculation.yearsOfService,
          avgSalary: 'avgSalary' in calculation ? calculation.avgSalary : undefined,
          attachmentUrl: parsed.data.attachmentUrl,
        },
        include: {
          employee: { select: { id: true, name: true, employeeNo: true } },
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'compliance.kr.severance-interim.create',
        resourceType: 'severanceInterimPayment',
        resourceId: payment.id,
        companyId: user.companyId,
        changes: { reason: parsed.data.reason, employeeId: parsed.data.employeeId },
        ip, userAgent,
      })

      return apiSuccess({
        ...payment,
        amount: payment.amount ? Number(payment.amount) : null,
        yearsOfService: payment.yearsOfService ? Number(payment.yearsOfService) : null,
        avgSalary: payment.avgSalary ? Number(payment.avgSalary) : null,
      }, 201)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.COMPLIANCE, ACTION.CREATE),
)
