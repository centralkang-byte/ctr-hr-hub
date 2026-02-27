// ═══════════════════════════════════════════════════════════
// CTR HR Hub — PUT /api/v1/disciplinary/[id]/appeal
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── Appeal Schema ────────────────────────────────────────

const appealSchema = z.object({
  appealText: z.string().min(1, '이의신청 내용을 입력해주세요.'),
})

// ─── PUT /api/v1/disciplinary/[id]/appeal ─────────────────

export const PUT = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params

    const companyFilter = user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

    const existing = await prisma.disciplinaryAction.findFirst({
      where: { id, deletedAt: null, ...companyFilter },
    })

    if (!existing) {
      throw notFound('징계 기록을 찾을 수 없습니다.')
    }

    if (existing.appealStatus !== 'NONE') {
      throw badRequest('이미 이의신청이 접수된 징계 기록입니다.')
    }

    const body: unknown = await req.json()
    const parsed = appealSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    try {
      const updated = await prisma.disciplinaryAction.update({
        where: { id },
        data: {
          appealStatus: 'FILED',
          appealDate: new Date(),
          appealText: parsed.data.appealText,
        },
        include: {
          employee: { select: { id: true, name: true, employeeNo: true } },
          issuer: { select: { id: true, name: true } },
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'disciplinary.appeal',
        resourceType: 'disciplinary_action',
        resourceId: id,
        companyId: existing.companyId,
        ip,
        userAgent,
      })

      return apiSuccess(updated)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.DISCIPLINE, ACTION.UPDATE),
)
