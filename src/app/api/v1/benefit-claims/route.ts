// src/app/api/v1/benefit-claims/route.ts
import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { z } from 'zod'
import type { SessionUser } from '@/types'

const createSchema = z.object({
  benefitPlanId: z.string().uuid(),
  claimAmount: z.number().int().positive(),
  eventDate: z.string().optional(),
  eventDetail: z.string().max(500).optional(),
  proofPaths: z.array(z.string()).default([]),
  notes: z.string().max(500).optional(),
})

export const GET = withPermission(
  async (req: NextRequest, _ctx: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const view = searchParams.get('view') ?? 'mine'
    const status = searchParams.get('status')
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 20)))
    const skip = (page - 1) * limit

    const isHR = user.role === ROLE.HR_ADMIN || user.role === ROLE.SUPER_ADMIN

    let where: Record<string, unknown> = {}

    if (!isHR || view === 'mine') {
      where.employeeId = user.employeeId
    } else if (view === 'pending') {
      where = {
        status: 'pending',
        employee: {
          assignments: {
            some: { companyId: user.companyId, isPrimary: true, endDate: null },
          },
        },
      }
    } else {
      // view === 'all'
      where = {
        employee: {
          assignments: {
            some: { companyId: user.companyId, isPrimary: true, endDate: null },
          },
        },
      }
    }

    if (status && view !== 'pending') where.status = status

    const [claims, total] = await Promise.all([
      prisma.benefitClaim.findMany({
        where,
        include: {
          benefitPlan: { select: { id: true, name: true, category: true, benefitType: true, currency: true } },
          employee: { select: { id: true, name: true, employeeNo: true } },
          approver: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.benefitClaim.count({ where }),
    ])

    return apiPaginated(claims, buildPagination(page, limit, total))
  },
  perm(MODULE.BENEFITS, ACTION.VIEW),
)

export const POST = withPermission(
  async (req: NextRequest, _ctx: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) throw badRequest(parsed.error.message)
    const { benefitPlanId, claimAmount, eventDate, eventDetail, proofPaths, notes } = parsed.data

    const plan = await prisma.benefitPlan.findFirst({
      where: { id: benefitPlanId, companyId: user.companyId, deletedAt: null },
    })
    if (!plan) throw badRequest('복리후생 항목을 찾을 수 없습니다.')

    if (plan.requiresProof && proofPaths.length === 0) {
      throw badRequest('이 복리후생 항목은 증빙 서류가 필요합니다.')
    }

    if (plan.benefitType === 'fixed_amount' && plan.amount && claimAmount !== plan.amount) {
      throw badRequest(`고정금액 항목입니다. 신청금액: ${plan.amount.toLocaleString()}`)
    }
    if (plan.maxAmount && claimAmount > plan.maxAmount) {
      throw badRequest(`최대 신청 한도(${plan.maxAmount.toLocaleString()})를 초과했습니다.`)
    }

    if (plan.frequency === 'annual' && plan.maxAmount) {
      const year = new Date().getFullYear()
      const startOfYear = new Date(year, 0, 1)
      const endOfYear = new Date(year + 1, 0, 1)
      const usedThisYear = await prisma.benefitClaim.aggregate({
        where: {
          benefitPlanId,
          employeeId: user.employeeId,
          status: { in: ['pending', 'approved', 'paid'] },
          createdAt: { gte: startOfYear, lt: endOfYear },
        },
        _sum: { claimAmount: true },
      })
      const usedAmount = usedThisYear._sum.claimAmount ?? 0
      if (usedAmount + claimAmount > plan.maxAmount) {
        throw badRequest(
          `연간 한도 초과. 잔여 한도: ${(plan.maxAmount - usedAmount).toLocaleString()}`
        )
      }
    }

    const claim = await prisma.benefitClaim.create({
      data: {
        benefitPlanId,
        employeeId: user.employeeId,
        claimAmount,
        eventDate: eventDate ? new Date(eventDate) : null,
        eventDetail: eventDetail ?? null,
        proofPaths,
        notes: notes ?? null,
        status: 'pending',
      },
      include: {
        benefitPlan: { select: { id: true, name: true, category: true, benefitType: true, currency: true } },
      },
    })

    return apiSuccess(claim, 201)
  },
  perm(MODULE.BENEFITS, ACTION.CREATE),
)
