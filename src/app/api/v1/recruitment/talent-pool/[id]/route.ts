// ═══════════════════════════════════════════════════════════
// CTR HR Hub — PATCH /api/v1/recruitment/talent-pool/[id]
// B4: Talent Pool 항목 상태 / 태그 업데이트
// 멀티테넌트: 회사 소유권을 write SQL(updateMany) 술어에 직접 유지 — by-id IDOR 차단.
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { resolveCompanyFilter } from '@/lib/api/companyFilter'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

const updateSchema = z.object({
  status: z.enum(['active', 'contacted', 'expired', 'hired']).optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
})

export const PATCH = withPermission(
  async (
    req: NextRequest,
    { params }: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id } = await params
    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) throw badRequest(parsed.error.message)

    // 회사 술어를 mutation SQL 에 유지(TOCTOU·IDOR 방어). 비-SUPER 는 자사·non-NULL 만.
    let count: number
    try {
      const result = await prisma.talentPoolEntry.updateMany({
        where: { id, ...resolveCompanyFilter(user) },
        data: { ...parsed.data },
      })
      count = result.count
    } catch (err) {
      throw handlePrismaError(err)
    }
    if (count === 0) throw notFound('Talent Pool 항목을 찾을 수 없습니다.')

    // 응답 재조회도 테넌트 스코프 유지(불변식 보존).
    const updated = await prisma.talentPoolEntry.findFirst({
      where: { id, ...resolveCompanyFilter(user) },
    })
    return apiSuccess(updated)
  },
  perm(MODULE.RECRUITMENT, ACTION.UPDATE),
)
