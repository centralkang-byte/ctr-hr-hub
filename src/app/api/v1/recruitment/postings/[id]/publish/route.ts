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

    // 1G: RBAC — HR_ADMIN 이상 또는 공고 작성자만 게시 가능
    const isCreator = existing.recruiterId === user.employeeId
    const isHrPlus = user.role === ROLE.HR_ADMIN || user.role === ROLE.SUPER_ADMIN
    if (!isCreator && !isHrPlus) {
      throw badRequest('게시 권한이 없습니다. 공고 작성자 또는 HR 관리자만 게시할 수 있습니다.')
    }

    // 1H: 필수 필드 검증 — departmentId, jobGradeId, recruiterId 필수
    if (!existing.departmentId) {
      throw badRequest('부서를 지정해야 게시할 수 있습니다.')
    }
    if (!existing.jobGradeId) {
      throw badRequest('직급을 지정해야 게시할 수 있습니다.')
    }
    if (!existing.recruiterId) {
      throw badRequest('채용 담당자를 지정해야 게시할 수 있습니다.')
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
