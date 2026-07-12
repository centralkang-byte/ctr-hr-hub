// ═══════════════════════════════════════════════════════════
// CTR HR Hub — My Training Enrollment Status (Self-Service)
// ═══════════════════════════════════════════════════════════
//
// PUT /api/v1/training/my/enrollments/[id]
// 본인 수강 상태 전이 — ENROLLED→IN_PROGRESS→ENROLLMENT_COMPLETED만 허용.
// completedAt/expiresAt은 서버가 계산 (셀프 score 입력 불가)

import { type NextRequest } from 'next/server'
import { addMonths } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, conflict, handlePrismaError, isAppError } from '@/lib/errors'
import { withAuth } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { trainingSelfStatusSchema } from '@/lib/schemas/training'
import type { SessionUser } from '@/types'

// 셀프서비스 허용 전이 (DROPPED/COMPLETED는 terminal)
const ALLOWED_TRANSITIONS: Record<string, string> = {
  ENROLLED: 'IN_PROGRESS',
  IN_PROGRESS: 'ENROLLMENT_COMPLETED',
}

export const PUT = withAuth(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const body: unknown = await req.json()
    const parsed = trainingSelfStatusSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }
    const { status } = parsed.data

    try {
      // 본인 소유 + 본인 법인/글로벌 과정만 (타법인 course가 붙은 이상 데이터 fail-closed)
      const existing = await prisma.trainingEnrollment.findFirst({
        where: {
          id,
          employeeId: user.employeeId,
          course: {
            deletedAt: null,
            OR: [{ companyId: user.companyId }, { companyId: null }],
          },
        },
        include: { course: { select: { validityMonths: true } } },
      })
      if (!existing) throw notFound('수강 기록을 찾을 수 없습니다.')

      if (ALLOWED_TRANSITIONS[existing.status] !== status) {
        throw conflict('허용되지 않는 상태 변경입니다.')
      }

      const now = new Date()
      const isCompleting = status === 'ENROLLMENT_COMPLETED'
      const result = await prisma.trainingEnrollment.update({
        where: { id },
        data: {
          status,
          ...(isCompleting && {
            completedAt: now,
            // 유효기간 있는 과정은 갱신 주기 기준으로 만료 재계산, 없으면 무기한
            expiresAt: existing.course.validityMonths
              ? addMonths(now, existing.course.validityMonths)
              : null,
          }),
        },
        include: {
          course: { select: { id: true, title: true, category: true, isMandatory: true } },
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'training.enrollment.selfStatusUpdate',
        resourceType: 'trainingEnrollment',
        resourceId: result.id,
        companyId: user.companyId,
        changes: { status },
        ip,
        userAgent,
      })

      return apiSuccess({ ...result, score: result.score ? Number(result.score) : null })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
)
