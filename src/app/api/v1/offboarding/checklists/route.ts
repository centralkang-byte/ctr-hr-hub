// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET/POST /api/v1/offboarding/checklists
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, forbidden } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, DEFAULT_PAGE_SIZE, DEFAULT_PAGE } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── Schemas ─────────────────────────────────────────────

const createSchema = z.object({
  name: z.string().min(1).max(100),
  targetType: z.enum(['VOLUNTARY', 'INVOLUNTARY', 'RETIREMENT', 'CONTRACT_END']),
  companyId: z.string().uuid().optional(),
})

// ─── GET /api/v1/offboarding/checklists ──────────────────

export const GET = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    // ⑥-C PR-2: 체크리스트(템플릿) 조회는 HR 설정 화면 전용 — MANAGER 의 offboarding_read 로 열리지 않게 role 가드
    if (user.role !== 'HR_ADMIN' && user.role !== 'SUPER_ADMIN') {
      throw forbidden('오프보딩 체크리스트는 HR 관리자만 조회할 수 있습니다.')
    }
    const p = Object.fromEntries(req.nextUrl.searchParams)
    const page = Number(p.page ?? DEFAULT_PAGE)
    const limit = Number(p.limit ?? DEFAULT_PAGE_SIZE)
    const companyId =
      user.role === 'SUPER_ADMIN' ? (p.companyId ?? undefined) : user.companyId

    const where = {
      ...(companyId ? { companyId } : {}),
      deletedAt: null,
    }

    const [total, checklists] = await Promise.all([
      prisma.offboardingChecklist.count({ where }),
      prisma.offboardingChecklist.findMany({
        where,
        include: { _count: { select: { offboardingTasks: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    return apiPaginated(checklists, buildPagination(page, limit, total))
  },
  perm(MODULE.OFFBOARDING, ACTION.VIEW),
)

// ─── POST /api/v1/offboarding/checklists ─────────────────

export const POST = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청입니다.', { issues: parsed.error.issues })
    }

    const { name, targetType, companyId: reqCompanyId } = parsed.data
    const companyId =
      user.role === 'SUPER_ADMIN' ? (reqCompanyId ?? user.companyId) : user.companyId

    const checklist = await prisma.offboardingChecklist.create({
      data: { name, targetType, companyId, deletedAt: null },
    })

    return apiSuccess(checklist, 201)
  },
  perm(MODULE.OFFBOARDING, ACTION.CREATE),
)
