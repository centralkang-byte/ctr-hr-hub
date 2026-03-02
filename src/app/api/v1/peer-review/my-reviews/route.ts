// ═══════════════════════════════════════════════════════════
// CTR HR Hub — My Peer Review Assignments
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

const querySchema = z.object({
  cycleId: z.string(),
})

// ─── GET /api/v1/peer-review/my-reviews ──────────────────
// Returns nominations where I (the logged-in user) am the nominee (reviewer)

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = querySchema.safeParse(params)
    if (!parsed.success) throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })

    const { cycleId } = parsed.data

    const nominations = await prisma.peerReviewNomination.findMany({
      where: {
        cycleId,
        nomineeId: user.id,
        status: 'NOMINATION_APPROVED',
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeNo: true,
            assignments: {
              where: { isPrimary: true, endDate: null },
              take: 1,
              include: {
                department: { select: { name: true } },
                jobGrade: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    // Check which ones already have a PEER evaluation submitted
    const existingEvals = await prisma.performanceEvaluation.findMany({
      where: {
        cycleId,
        evaluatorId: user.id,
        evalType: 'PEER',
        employeeId: { in: nominations.map((n) => n.employeeId) },
      },
      select: { employeeId: true, status: true },
    })
    const evalMap = new Map(existingEvals.map((e) => [e.employeeId, e.status]))

    const result = nominations.map((n) => ({
      nominationId: n.id,
      employee: n.employee,
      evalStatus: evalMap.get(n.employeeId) ?? null,
    }))

    return apiSuccess(result)
  },
  perm(MODULE.PERFORMANCE, ACTION.VIEW),
)
