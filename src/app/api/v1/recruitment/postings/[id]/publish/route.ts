// ═══════════════════════════════════════════════════════════
// CTR HR Hub — PUT /api/v1/recruitment/postings/[id]/publish
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound, badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── PUT /api/v1/recruitment/postings/[id]/publish ────────

export const PUT = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params

    const companyFilter = user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

    const existing = await prisma.jobPosting.findFirst({
      where: { id, deletedAt: null, ...companyFilter },
    })

    if (!existing) {
      throw notFound('채용 공고를 찾을 수 없습니다.')
    }

    if (existing.status !== 'DRAFT') {
      throw badRequest('초안(DRAFT) 상태의 공고만 게시할 수 있습니다.')
    }

    const updated = await prisma.jobPosting.update({
      where: { id },
      data: {
        status: 'OPEN',
        postedAt: new Date(),
      },
      include: {
        department: { select: { id: true, name: true } },
        jobGrade: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
      },
    })

    const { ip, userAgent } = extractRequestMeta(req.headers)
    logAudit({
      actorId: user.employeeId,
      action: 'recruitment.posting.publish',
      resourceType: 'job_posting',
      resourceId: id,
      companyId: existing.companyId,
      ip,
      userAgent,
    })

    return apiSuccess({
      ...updated,
      salaryRangeMin: updated.salaryRangeMin ? Number(updated.salaryRangeMin) : null,
      salaryRangeMax: updated.salaryRangeMax ? Number(updated.salaryRangeMax) : null,
    })
  },
  perm(MODULE.RECRUITMENT, ACTION.UPDATE),
)
