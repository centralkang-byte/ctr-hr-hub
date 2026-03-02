// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Admin Performance Results (Company-wide)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiPaginated, buildPagination } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '@/lib/constants'
import type { SessionUser } from '@/types'

const searchSchema = z.object({
  cycleId: z.string().cuid(),
  departmentId: z.string().optional(),
  emsBlock: z.string().optional(),
  page: z.coerce.number().int().positive().default(DEFAULT_PAGE),
  limit: z.coerce.number().int().positive().max(100).default(DEFAULT_PAGE_SIZE),
})

// ─── GET /api/v1/performance/results/admin ───────────────

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = searchSchema.safeParse(params)
    if (!parsed.success) throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })

    const { cycleId, departmentId, emsBlock, page, limit } = parsed.data

    // Get manager evaluations (final submitted) with optional filters
    const where = {
      cycleId,
      companyId: user.companyId,
      evalType: 'MANAGER' as const,
      status: 'SUBMITTED' as const,
      ...(departmentId
        ? {
            employee: {
              assignments: {
                some: { departmentId, isPrimary: true, endDate: null },
              },
            },
          }
        : {}),
      ...(emsBlock ? { emsBlock } : {}),
    }

    const [evaluations, total] = await Promise.all([
      prisma.performanceEvaluation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          employee: {
            select: {
              id: true, name: true, employeeNo: true,
              assignments: {
                where: { isPrimary: true, endDate: null },
                take: 1,
                include: {
                  department: { select: { id: true, name: true } },
                  jobGrade: { select: { name: true } },
                },
              },
            },
          },
          evaluator: { select: { id: true, name: true } },
        },
      }),
      prisma.performanceEvaluation.count({ where }),
    ])

    // Get calibration adjustments for these employees
    const employeeIds = evaluations.map((e) => e.employeeId)
    const adjustments = await prisma.calibrationAdjustment.findMany({
      where: {
        employeeId: { in: employeeIds },
        session: { cycleId, companyId: user.companyId },
      },
      orderBy: { adjustedAt: 'desc' },
    })

    const adjMap = new Map<string, typeof adjustments[0]>()
    for (const adj of adjustments) {
      if (!adjMap.has(adj.employeeId)) adjMap.set(adj.employeeId, adj)
    }

    // Get self evaluations
    const selfEvals = await prisma.performanceEvaluation.findMany({
      where: {
        cycleId,
        employeeId: { in: employeeIds },
        evalType: 'SELF',
        companyId: user.companyId,
      },
    })
    const selfMap = new Map(selfEvals.map((e) => [e.employeeId, e]))

    const results = evaluations.map((ev) => {
      const adj = adjMap.get(ev.employeeId)
      const self = selfMap.get(ev.employeeId)

      return {
        employee: ev.employee,
        evaluator: ev.evaluator,
        selfEval: self
          ? { performanceScore: self.performanceScore ? Number(self.performanceScore) : null, competencyScore: self.competencyScore ? Number(self.competencyScore) : null, emsBlock: self.emsBlock }
          : null,
        managerEval: {
          performanceScore: ev.performanceScore ? Number(ev.performanceScore) : null,
          competencyScore: ev.competencyScore ? Number(ev.competencyScore) : null,
          emsBlock: ev.emsBlock,
        },
        finalResult: adj
          ? { performanceScore: Number(adj.adjustedPerformanceScore), competencyScore: Number(adj.adjustedCompetencyScore), emsBlock: adj.adjustedBlock, calibrated: true }
          : { performanceScore: ev.performanceScore ? Number(ev.performanceScore) : null, competencyScore: ev.competencyScore ? Number(ev.competencyScore) : null, emsBlock: ev.emsBlock, calibrated: false },
      }
    })

    return apiPaginated(results, buildPagination(page, limit, total))
  },
  perm(MODULE.PERFORMANCE, ACTION.APPROVE),
)
