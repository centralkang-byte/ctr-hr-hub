// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/recruitment/internal-jobs
// B4: Internal Mobility — 직원용 내부 공고 목록
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
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(50).default(DEFAULT_PAGE_SIZE),
  companyId: z.string().optional(),
  employmentType: z.string().optional(),
  search: z.string().optional(),
})

export const GET = withPermission(
  async (req: NextRequest, _context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = searchSchema.safeParse(params)
    if (!parsed.success) throw badRequest('잘못된 파라미터입니다.')

    const { page, limit, companyId, employmentType, search } = parsed.data
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {
      isInternal: true,
      status: 'OPEN',
      deletedAt: null,
    }

    if (companyId) where.companyId = companyId
    if (employmentType) where.employmentType = employmentType
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [total, data] = await Promise.all([
      prisma.jobPosting.count({ where }),
      prisma.jobPosting.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          company: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
          position: { select: { id: true, code: true, titleKo: true } },
          requisition: {
            select: { urgency: true, targetDate: true },
          },
        },
      }),
    ])

    // 현재 사용자가 이미 지원한 공고 ID 조회
    const userEmail = user.email ?? ''
    const appliedPostingIds = userEmail
      ? await prisma.application.findMany({
          where: {
            posting: { isInternal: true },
            applicant: { email: userEmail },
          },
          select: { postingId: true, stage: true },
        })
      : []

    const appliedMap = new Map(appliedPostingIds.map((a) => [a.postingId, a.stage]))

    const items = data.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      employmentType: p.employmentType,
      headcount: p.headcount,
      location: (p as any // eslint-disable-line @typescript-eslint/no-explicit-any -- Prisma model field not in select type).location,
      workMode: (p as any // eslint-disable-line @typescript-eslint/no-explicit-any -- Prisma model field not in select type).workMode,
      deadlineDate: (p as any // eslint-disable-line @typescript-eslint/no-explicit-any -- Prisma type gap).deadlineDate,
      salaryRangeMin: (p as any).salaryRangeMin ? Number((p as any).salaryRangeMin) : null, // eslint-disable-line @typescript-eslint/no-explicit-any -- Prisma type gap
      salaryRangeMax: (p as any).salaryRangeMax ? Number((p as any).salaryRangeMax) : null, // eslint-disable-line @typescript-eslint/no-explicit-any -- Prisma type gap
      salaryHidden: (p as any // eslint-disable-line @typescript-eslint/no-explicit-any -- Prisma type gap).salaryHidden,
      company: p.company,
      department: p.department,
      position: p.position,
      urgency: p.requisition?.urgency ?? 'normal',
      targetDate: p.requisition?.targetDate ?? null,
      alreadyApplied: appliedMap.has(p.id),
      myStage: appliedMap.get(p.id) ?? null,
      createdAt: p.createdAt,
    }))

    return apiPaginated(items, buildPagination(page, limit, total))
  },
  perm(MODULE.RECRUITMENT, ACTION.VIEW),
)
