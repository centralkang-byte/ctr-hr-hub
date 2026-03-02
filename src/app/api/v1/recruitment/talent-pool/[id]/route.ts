// ═══════════════════════════════════════════════════════════
// CTR HR Hub — PATCH /api/v1/recruitment/talent-pool/[id]
// B4: Talent Pool 항목 상태 / 태그 업데이트
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
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
    _user: SessionUser,
  ) => {
    const { id } = await params
    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) throw badRequest(parsed.error.message)

    const entry = await prisma.talentPoolEntry.findUnique({ where: { id } })
    if (!entry) throw notFound('Talent Pool 항목을 찾을 수 없습니다.')

    try {
      const updated = await prisma.talentPoolEntry.update({
        where: { id },
        data: { ...parsed.data },
      })
      return apiSuccess(updated)
    } catch (err) {
      throw handlePrismaError(err)
    }
  },
  perm(MODULE.RECRUITMENT, ACTION.UPDATE),
)
