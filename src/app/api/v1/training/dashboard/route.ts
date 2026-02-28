// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Training Dashboard KPIs
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/training/dashboard ─────────────────────

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const companyId = user.companyId

    const [totalCourses, activeCourses, totalEnrollments, completedEnrollments, mandatoryCourses, mandatoryCompleted] =
      await Promise.all([
        prisma.trainingCourse.count({ where: { companyId, deletedAt: null } }),
        prisma.trainingCourse.count({ where: { companyId, deletedAt: null, isActive: true } }),
        prisma.trainingEnrollment.count({ where: { course: { companyId, deletedAt: null } } }),
        prisma.trainingEnrollment.count({
          where: { course: { companyId, deletedAt: null }, status: 'ENROLLMENT_COMPLETED' },
        }),
        prisma.trainingEnrollment.count({
          where: { course: { companyId, deletedAt: null, isMandatory: true } },
        }),
        prisma.trainingEnrollment.count({
          where: {
            course: { companyId, deletedAt: null, isMandatory: true },
            status: 'ENROLLMENT_COMPLETED',
          },
        }),
      ])

    const completionRate = totalEnrollments > 0 ? Math.round((completedEnrollments / totalEnrollments) * 100) : 0
    const mandatoryCompletionRate = mandatoryCourses > 0 ? Math.round((mandatoryCompleted / mandatoryCourses) * 100) : 0

    return apiSuccess({
      totalCourses,
      activeCourses,
      totalEnrollments,
      completedEnrollments,
      completionRate,
      mandatoryCourses,
      mandatoryCompleted,
      mandatoryCompletionRate,
    })
  },
  perm(MODULE.TRAINING, ACTION.VIEW),
)
