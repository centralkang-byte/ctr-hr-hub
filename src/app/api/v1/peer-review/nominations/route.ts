// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Peer Review Nominations CRUD
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── Schemas ──────────────────────────────────────────────

const listSchema = z.object({
  cycleId: z.string(),
  employeeId: z.string().optional(),
  status: z.enum(['PROPOSED', 'NOMINATION_APPROVED', 'NOMINATION_REJECTED', 'NOMINATION_COMPLETED']).optional(),
  page: z.coerce.number().int().positive().default(1),
  size: z.coerce.number().int().positive().max(100).default(20),
})

const createSchema = z.object({
  cycleId: z.string(),
  employeeId: z.string(),
  nomineeId: z.string(),
  nominationSource: z.enum(['AI_RECOMMENDED', 'SELF_NOMINATED', 'MANAGER_ASSIGNED', 'HR_ASSIGNED']),
  collaborationTotalScore: z.number().optional(),
})

// ─── GET /api/v1/peer-review/nominations ─────────────────

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = listSchema.safeParse(params)
    if (!parsed.success) throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })

    const { cycleId, employeeId, status, page, size } = parsed.data

    const where = {
      cycleId,
      cycle: { companyId: user.companyId },
      ...(employeeId ? { employeeId } : {}),
      ...(status ? { status } : {}),
    }

    const [items, total] = await Promise.all([
      prisma.peerReviewNomination.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true, name: true, employeeNo: true,
              assignments: {
                where: { isPrimary: true, endDate: null },
                take: 1,
                include: { department: { select: { name: true } } },
              },
            },
          },
          nominee: {
            select: {
              id: true, name: true, employeeNo: true,
              assignments: {
                where: { isPrimary: true, endDate: null },
                take: 1,
                include: { department: { select: { name: true } } },
              },
            },
          },
          approver: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * size,
        take: size,
      }),
      prisma.peerReviewNomination.count({ where }),
    ])

    return apiPaginated(items, buildPagination(page, size, total))
  },
  perm(MODULE.PERFORMANCE, ACTION.VIEW),
)

// ─── POST /api/v1/peer-review/nominations ────────────────

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) throw badRequest('잘못된 데이터입니다.', { issues: parsed.error.issues })

    const { cycleId, employeeId, nomineeId, nominationSource, collaborationTotalScore } = parsed.data

    if (employeeId === nomineeId) {
      throw badRequest('자기 자신을 동료 평가자로 지정할 수 없습니다.')
    }

    try {
      const nomination = await prisma.peerReviewNomination.create({
        data: {
          cycleId,
          employeeId,
          nomineeId,
          nominationSource,
          collaborationTotalScore,
          status: 'PROPOSED',
        },
        include: {
          employee: { select: { id: true, name: true } },
          nominee: { select: { id: true, name: true } },
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        action: 'PEER_NOMINATION_CREATED',
        actorId: user.employeeId,
        companyId: user.companyId,
        resourceType: 'PeerReviewNomination',
        resourceId: nomination.id,
        changes: { employeeId, nomineeId, nominationSource },
        ip,
        userAgent,
      })

      return apiSuccess(nomination, 201)
    } catch (err) {
      throw handlePrismaError(err)
    }
  },
  perm(MODULE.PERFORMANCE, ACTION.CREATE),
)
