// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Salary Band Detail, Update & Delete
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { salaryBandUpdateSchema } from '@/lib/schemas/compensation'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/compensation/salary-bands/[id] ────────
// Single salary band detail, company scoped

export const GET = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params

    const band = await prisma.salaryBand.findFirst({
      where: {
        id,
        companyId: user.companyId,
        deletedAt: null,
      },
      include: {
        jobGrade: { select: { id: true, code: true, name: true } },
        jobCategory: { select: { id: true, code: true, name: true } },
      },
    })

    if (!band) throw notFound('급여 밴드를 찾을 수 없습니다.')

    return apiSuccess({
      ...band,
      minSalary: Number(band.minSalary),
      midSalary: Number(band.midSalary),
      maxSalary: Number(band.maxSalary),
    })
  },
  perm(MODULE.COMPENSATION, ACTION.VIEW),
)

// ─── PUT /api/v1/compensation/salary-bands/[id] ────────
// Update salary band

export const PUT = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const body: unknown = await req.json()
    const parsed = salaryBandUpdateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    try {
      // Verify existence & company scope
      const existing = await prisma.salaryBand.findFirst({
        where: {
          id,
          companyId: user.companyId,
          deletedAt: null,
        },
      })
      if (!existing) throw notFound('급여 밴드를 찾을 수 없습니다.')

      // Build update data, merging existing values for salary validation
      const data = parsed.data
      const finalMin = data.minSalary ?? Number(existing.minSalary)
      const finalMid = data.midSalary ?? Number(existing.midSalary)
      const finalMax = data.maxSalary ?? Number(existing.maxSalary)

      // Validate min < mid < max after merge
      if (!(finalMin < finalMid && finalMid < finalMax)) {
        throw badRequest('min < mid < max 순서여야 합니다.')
      }

      const result = await prisma.salaryBand.update({
        where: { id },
        data: {
          ...(data.jobGradeId !== undefined && { jobGradeId: data.jobGradeId }),
          ...(data.jobCategoryId !== undefined && { jobCategoryId: data.jobCategoryId }),
          ...(data.currency !== undefined && { currency: data.currency }),
          ...(data.minSalary !== undefined && { minSalary: data.minSalary }),
          ...(data.midSalary !== undefined && { midSalary: data.midSalary }),
          ...(data.maxSalary !== undefined && { maxSalary: data.maxSalary }),
          ...(data.effectiveFrom !== undefined && { effectiveFrom: new Date(data.effectiveFrom) }),
          ...(data.effectiveTo !== undefined && { effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null }),
        },
        include: {
          jobGrade: { select: { id: true, code: true, name: true } },
          jobCategory: { select: { id: true, code: true, name: true } },
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'compensation.salaryBand.update',
        resourceType: 'salaryBand',
        resourceId: result.id,
        companyId: result.companyId,
        ip,
        userAgent,
      })

      return apiSuccess({
        ...result,
        minSalary: Number(result.minSalary),
        midSalary: Number(result.midSalary),
        maxSalary: Number(result.maxSalary),
      })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.COMPENSATION, ACTION.UPDATE),
)

// ─── DELETE /api/v1/compensation/salary-bands/[id] ─────
// Soft delete (set deletedAt)

export const DELETE = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params

    try {
      // Verify existence & company scope
      const existing = await prisma.salaryBand.findFirst({
        where: {
          id,
          companyId: user.companyId,
          deletedAt: null,
        },
      })
      if (!existing) throw notFound('급여 밴드를 찾을 수 없습니다.')

      const result = await prisma.salaryBand.update({
        where: { id },
        data: { deletedAt: new Date() },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'compensation.salaryBand.delete',
        resourceType: 'salaryBand',
        resourceId: result.id,
        companyId: result.companyId,
        ip,
        userAgent,
      })

      return apiSuccess({ id: result.id })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.COMPENSATION, ACTION.DELETE),
)
