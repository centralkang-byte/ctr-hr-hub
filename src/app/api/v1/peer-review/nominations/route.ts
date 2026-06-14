// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Peer Review Nominations CRUD
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { forbidden } from '@/lib/errors'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { EMPLOYEE_MINIMAL_SELECT, toMinimalEmployee } from '@/lib/employee-utils'
import { getDirectReportIds } from '@/lib/employee/direct-reports'
import type { SessionUser } from '@/types'

// 지명 목록은 reviewer(nominee) 실명·PII와 reviewer↔대상 매핑을 담는 관리용 뷰.
// perm(VIEW)만으론 EMPLOYEE도 통과해 동료평가 반익명성이 깨지므로 매니저 이상으로 한정하고,
// MANAGER는 직속 보고 대상으로 스코프(cross-team 매핑 누출 차단). HR/임원/SUPER만 전사.
const MANAGER_UP: Set<string> = new Set([ROLE.SUPER_ADMIN, ROLE.HR_ADMIN, ROLE.EXECUTIVE, ROLE.MANAGER])
const HR_UP: Set<string> = new Set([ROLE.SUPER_ADMIN, ROLE.HR_ADMIN, ROLE.EXECUTIVE])

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
    if (!MANAGER_UP.has(user.role as string)) {
      throw forbidden('매니저 이상만 조회할 수 있습니다.')
    }

    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = listSchema.safeParse(params)
    if (!parsed.success) throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })

    const { cycleId, employeeId, status, page, size } = parsed.data

    // MANAGER는 직속 보고 대상으로 스코프 — 회사 전체 reviewer↔대상 매핑 cross-team 누출 차단.
    let reportIds: string[] | null = null
    if (!HR_UP.has(user.role as string)) {
      reportIds = await getDirectReportIds(user.employeeId)
      if (employeeId && !reportIds.includes(employeeId)) {
        return apiPaginated([], buildPagination(page, size, 0))
      }
    }
    const employeeWhere = employeeId
      ? { employeeId }
      : reportIds
        ? { employeeId: { in: reportIds } }
        : {}

    const where = {
      cycleId,
      cycle: { companyId: user.companyId },
      ...employeeWhere,
      ...(status ? { status } : {}),
    }

    const [items, total] = await Promise.all([
      prisma.peerReviewNomination.findMany({
        where,
        include: {
          employee: { select: { ...EMPLOYEE_MINIMAL_SELECT } },
          nominee: { select: { ...EMPLOYEE_MINIMAL_SELECT } },
          approver: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * size,
        take: size,
      }),
      prisma.peerReviewNomination.count({ where }),
    ])

    return apiPaginated(
      items.map((item) => ({
        ...item,
        employee: toMinimalEmployee(item.employee as unknown),
        nominee: toMinimalEmployee(item.nominee as unknown),
      })),
      buildPagination(page, size, total)
    )
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
