// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Mandatory Training Status Dashboard (B9-1)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const url = req.nextUrl
    const year = Number(url.searchParams.get('year') ?? new Date().getFullYear())
    const companyId = url.searchParams.get('companyId') ?? user.companyId

    // 법정 의무교육 과정 목록 (mandatory_training_configs 기반)
    const configs = await prisma.mandatoryTrainingConfig.findMany({
      where: {
        OR: [{ companyId }, { companyId: null }],
        deletedAt: null,
      },
      include: {
        course: {
          select: {
            id: true,
            code: true,
            title: true,
            category: true,
            durationHours: true,
            validityMonths: true,
          },
        },
      },
    })

    // 전체 대상 직원 수
    const totalEmployees = await prisma.employee.count({
      where: {
        assignments: {
          some: { companyId, isPrimary: true, endDate: null, status: 'ACTIVE' },
        },
        deletedAt: null,
      },
    })

    const courseStatus = await Promise.all(
      configs.map(async (config) => {
        const deadlineMonth = config.deadlineMonth ?? 12
        const deadlineDate = new Date(year, deadlineMonth - 1, 31)
        const startOfYear = new Date(year, 0, 1)

        // 이수 완료자 (해당 연도 기준)
        const completed = await prisma.trainingEnrollment.count({
          where: {
            courseId: config.courseId,
            status: 'ENROLLMENT_COMPLETED',
            completedAt: { gte: startOfYear, lte: deadlineDate },
            employee: {
              assignments: {
                some: { companyId, isPrimary: true, endDate: null, status: 'ACTIVE' },
              },
            },
          },
        })

        // 등록 중 (미이수)
        const enrolled = await prisma.trainingEnrollment.count({
          where: {
            courseId: config.courseId,
            status: { in: ['ENROLLED', 'IN_PROGRESS'] },
            expiresAt: { gte: new Date() },
            employee: {
              assignments: {
                some: { companyId, isPrimary: true, endDate: null, status: 'ACTIVE' },
              },
            },
          },
        })

        // 30일 이내 만료 예정
        const thirtyDaysLater = new Date()
        thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30)
        const expiringSoon = await prisma.trainingEnrollment.count({
          where: {
            courseId: config.courseId,
            status: 'ENROLLMENT_COMPLETED',
            expiresAt: { gte: new Date(), lte: thirtyDaysLater },
            employee: {
              assignments: {
                some: { companyId, isPrimary: true, endDate: null, status: 'ACTIVE' },
              },
            },
          },
        })

        const completionRate = totalEmployees > 0
          ? Math.round((completed / totalEmployees) * 100)
          : 0

        return {
          configId: config.id,
          courseId: config.courseId,
          course: {
            ...config.course,
            durationHours: config.course.durationHours
              ? Number(config.course.durationHours)
              : null,
          },
          targetGroup: config.targetGroup,
          frequency: config.frequency,
          deadlineMonth,
          deadlineDate,
          year,
          totalEmployees,
          completed,
          enrolled,
          pending: Math.max(0, totalEmployees - completed - enrolled),
          expiringSoon,
          completionRate,
        }
      }),
    )

    return apiSuccess({
      year,
      companyId,
      totalEmployees,
      courseStatus,
    })
  },
  perm(MODULE.TRAINING, ACTION.VIEW),
)
