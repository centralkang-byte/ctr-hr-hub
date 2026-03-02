// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Peer Review Team Results (Manager / HR Admin)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

const querySchema = z.object({
  cycleId: z.string(),
})

// ─── GET /api/v1/peer-review/results/team ────────────────

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = querySchema.safeParse(params)
    if (!parsed.success) throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })

    const { cycleId } = parsed.data

    const cycle = await prisma.performanceCycle.findFirst({
      where: { id: cycleId, companyId: user.companyId },
    })
    if (!cycle) throw notFound('평가 주기를 찾을 수 없습니다.')

    // Get all nominations for this cycle
    const nominations = await prisma.peerReviewNomination.findMany({
      where: { cycleId },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeNo: true,
            assignments: {
              where: { isPrimary: true, endDate: null },
              take: 1,
              include: { department: { select: { name: true } } },
            },
          },
        },
      },
    })

    // Get all peer evaluations for this cycle
    const evaluations = await prisma.performanceEvaluation.findMany({
      where: {
        cycleId,
        evalType: 'PEER',
        companyId: user.companyId,
      },
      select: {
        employeeId: true,
        competencyScore: true,
      },
    })

    // Aggregate per employee
    const employeeMap = new Map<string, {
      employee: { id: string; name: string; employeeNo: string; department: string }
      nominationCount: number
      completedCount: number
      avgScore: number | null
    }>()

    for (const n of nominations) {
      const empId = n.employeeId
      if (!employeeMap.has(empId)) {
        employeeMap.set(empId, {
          employee: {
            id: n.employee.id,
            name: n.employee.name,
            employeeNo: n.employee.employeeNo,
            department: n.employee.assignments?.[0]?.department?.name ?? '-',
          },
          nominationCount: 0,
          completedCount: 0,
          avgScore: null,
        })
      }
      const entry = employeeMap.get(empId)!
      entry.nominationCount++
      if (n.status === 'NOMINATION_COMPLETED') entry.completedCount++
    }

    for (const [empId, entry] of employeeMap.entries()) {
      const empEvals = evaluations.filter((e) => e.employeeId === empId)
      if (empEvals.length > 0) {
        const scores = empEvals.map((e) => Number(e.competencyScore ?? 0))
        entry.avgScore = Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 100) / 100
      }
    }

    const result = Array.from(employeeMap.values()).sort((a, b) => a.employee.name.localeCompare(b.employee.name))

    return apiSuccess({
      cycleId,
      totalEmployees: result.length,
      totalNominations: nominations.length,
      completionRate: nominations.length > 0
        ? Math.round((nominations.filter((n) => n.status === 'NOMINATION_COMPLETED').length / nominations.length) * 100)
        : 0,
      employees: result,
    })
  },
  perm(MODULE.PERFORMANCE, ACTION.APPROVE),
)
