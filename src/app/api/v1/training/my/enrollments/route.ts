// ═══════════════════════════════════════════════════════════
// CTR HR Hub — My Training Self-Enrollment
// ═══════════════════════════════════════════════════════════
//
// POST /api/v1/training/my/enrollments
// 본인 수강 신청 — employeeId는 세션에서 강제 (셀프서비스, withAuth)

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, conflict, handlePrismaError, isAppError } from '@/lib/errors'
import { withAuth } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { trainingSelfEnrollSchema } from '@/lib/schemas/training'
import type { SessionUser } from '@/types'

export const POST = withAuth(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = trainingSelfEnrollSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }
    const { courseId } = parsed.data

    // 본인 법인 또는 글로벌 과정만 신청 가능
    const course = await prisma.trainingCourse.findFirst({
      where: {
        id: courseId,
        deletedAt: null,
        OR: [{ companyId: user.companyId }, { companyId: null }],
      },
      select: { id: true },
    })
    if (!course) throw badRequest('유효하지 않은 과정입니다.')

    try {
      const result = await prisma.trainingEnrollment.create({
        data: {
          courseId,
          employeeId: user.employeeId,
          status: 'ENROLLED',
          source: 'manual',
          enrolledAt: new Date(),
        },
        include: {
          course: { select: { id: true, title: true, category: true, isMandatory: true } },
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'training.enrollment.selfEnroll',
        resourceType: 'trainingEnrollment',
        resourceId: result.id,
        companyId: user.companyId,
        changes: { courseId },
        ip,
        userAgent,
      })

      return apiSuccess({ ...result, score: result.score ? Number(result.score) : null }, 201)
    } catch (error) {
      if (isAppError(error)) throw error
      // 중복 신청은 사용자 친화 메시지로 (handlePrismaError의 필드명 노출 회피)
      if ((error as { code?: string }).code === 'P2002') {
        throw conflict('이미 등록된 과정입니다.')
      }
      throw handlePrismaError(error)
    }
  },
)
