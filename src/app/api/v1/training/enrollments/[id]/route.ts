// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Training Enrollment Update (Status Change)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { trainingEnrollmentUpdateSchema } from '@/lib/schemas/training'
import type { SessionUser } from '@/types'

// ─── PUT /api/v1/training/enrollments/[id] ──────────────

export const PUT = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const body: unknown = await req.json()
    const parsed = trainingEnrollmentUpdateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    try {
      const existing = await prisma.trainingEnrollment.findFirst({
        where: { id },
        include: { course: { select: { companyId: true } } },
      })
      if (!existing || existing.course.companyId !== user.companyId) {
        throw notFound('수강 기록을 찾을 수 없습니다.')
      }

      const data = parsed.data
      const result = await prisma.trainingEnrollment.update({
        where: { id },
        data: {
          status: data.status,
          ...(data.score !== undefined && { score: data.score }),
          ...(data.completedAt !== undefined && { completedAt: new Date(data.completedAt) }),
        },
        include: {
          employee: { select: { id: true, name: true, employeeNo: true } },
          course: { select: { id: true, title: true, category: true, isMandatory: true } },
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'training.enrollment.update',
        resourceType: 'trainingEnrollment',
        resourceId: result.id,
        companyId: user.companyId,
        changes: { status: data.status },
        ip,
        userAgent,
      })

      return apiSuccess({ ...result, score: result.score ? Number(result.score) : null })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.TRAINING, ACTION.APPROVE),
)
