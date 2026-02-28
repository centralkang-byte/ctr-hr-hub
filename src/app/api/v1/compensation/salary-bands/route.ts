// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Salary Band List & Create
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '@/lib/constants'
import { salaryBandSearchSchema, salaryBandCreateSchema } from '@/lib/schemas/compensation'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/compensation/salary-bands ──────────────
// Paginated list with jobGradeId/jobCategoryId filters, company scoped

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = salaryBandSearchSchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { page, limit, jobGradeId, jobCategoryId } = parsed.data
    const companyId = user.companyId

    const where = {
      companyId,
      deletedAt: null,
      ...(jobGradeId ? { jobGradeId } : {}),
      ...(jobCategoryId ? { jobCategoryId } : {}),
    }

    const [bands, total] = await Promise.all([
      prisma.salaryBand.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          jobGrade: { select: { id: true, code: true, name: true } },
          jobCategory: { select: { id: true, code: true, name: true } },
        },
      }),
      prisma.salaryBand.count({ where }),
    ])

    // Convert Decimal fields to numbers for JSON serialization
    const serialized = bands.map((b) => ({
      ...b,
      minSalary: Number(b.minSalary),
      midSalary: Number(b.midSalary),
      maxSalary: Number(b.maxSalary),
    }))

    return apiPaginated(serialized, buildPagination(page, limit, total))
  },
  perm(MODULE.COMPENSATION, ACTION.VIEW),
)

// ─── POST /api/v1/compensation/salary-bands ─────────────
// Create a new salary band

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = salaryBandCreateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { jobGradeId, jobCategoryId, currency, minSalary, midSalary, maxSalary, effectiveFrom, effectiveTo } = parsed.data

    try {
      const band = await prisma.salaryBand.create({
        data: {
          companyId: user.companyId,
          jobGradeId,
          jobCategoryId,
          currency,
          minSalary,
          midSalary,
          maxSalary,
          effectiveFrom: new Date(effectiveFrom),
          ...(effectiveTo ? { effectiveTo: new Date(effectiveTo) } : {}),
        },
        include: {
          jobGrade: { select: { id: true, code: true, name: true } },
          jobCategory: { select: { id: true, code: true, name: true } },
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'compensation.salaryBand.create',
        resourceType: 'salaryBand',
        resourceId: band.id,
        companyId: band.companyId,
        changes: { jobGradeId, currency, minSalary, midSalary, maxSalary },
        ip,
        userAgent,
      })

      return apiSuccess(
        {
          ...band,
          minSalary: Number(band.minSalary),
          midSalary: Number(band.midSalary),
          maxSalary: Number(band.maxSalary),
        },
        201,
      )
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.COMPENSATION, ACTION.CREATE),
)
