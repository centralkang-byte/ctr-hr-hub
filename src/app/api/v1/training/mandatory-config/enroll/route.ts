// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Mandatory Training Auto-Enrollment (B9-1)
// ═══════════════════════════════════════════════════════════
//
// POST /api/v1/training/mandatory-config/enroll
// 법정 의무교육 자동 등록 (연간 배치)
// HR Admin이 수동 트리거 또는 cron으로 호출

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { z } from 'zod'
import type { SessionUser } from '@/types'

const enrollSchema = z.object({
  year: z.number().int().min(2020).max(2099),
  companyId: z.string().uuid().optional(),
})

// targetGroup → 대상 직원 필터 헬퍼
async function getTargetEmployees(companyId: string, targetGroup: string) {
  const baseWhere = {
    assignments: {
      some: {
        companyId,
        isPrimary: true,
        endDate: null,
        status: 'ACTIVE',
      },
    },
    deletedAt: null,
  }

  if (targetGroup === 'all') {
    return prisma.employee.findMany({ where: baseWhere, select: { id: true } })
  }

  if (targetGroup === 'manager') {
    return prisma.employee.findMany({
      where: {
        ...baseWhere,
        employeeRoles: { some: { role: { code: { in: ['MANAGER', 'HR_ADMIN', 'SUPER_ADMIN'] } } } },
      },
      select: { id: true },
    })
  }

  if (targetGroup === 'new_hire') {
    // 입사 후 1년 미만
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
    return prisma.employee.findMany({
      where: { ...baseWhere, hireDate: { gte: oneYearAgo } },
      select: { id: true },
    })
  }

  // production, etc. — 전 직원 fallback
  return prisma.employee.findMany({ where: baseWhere, select: { id: true } })
}

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = enrollSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { year } = parsed.data
    const targetCompanyId = parsed.data.companyId ?? user.companyId

    const configs = await prisma.mandatoryTrainingConfig.findMany({
      where: {
        OR: [{ companyId: targetCompanyId }, { companyId: null }],
        isActive: true,
      },
      include: {
        course: { select: { id: true, validityMonths: true } },
      },
    })

    let totalEnrolled = 0
    let totalSkipped = 0

    try {
      for (const config of configs) {
        const employees = await getTargetEmployees(targetCompanyId, config.targetGroup)

        for (const emp of employees) {
          // 유효한 이수 완료 이력이 있으면 스킵
          const existing = await prisma.trainingEnrollment.findFirst({
            where: {
              courseId: config.courseId,
              employeeId: emp.id,
              status: 'ENROLLMENT_COMPLETED',
              ...(config.course.validityMonths
                ? { expiresAt: { gt: new Date() } }
                : {}),
            },
          })

          if (existing) {
            totalSkipped++
            continue
          }

          // 이미 등록 중인지 확인 (unique constraint 회피)
          const alreadyEnrolled = await prisma.trainingEnrollment.findUnique({
            where: { courseId_employeeId: { courseId: config.courseId, employeeId: emp.id } },
          })

          if (alreadyEnrolled) {
            totalSkipped++
            continue
          }

          // 마감일 계산
          const deadlineMonth = config.deadlineMonth ?? 12
          const expiresAt = new Date(year, deadlineMonth - 1, 31)

          await prisma.trainingEnrollment.create({
            data: {
              courseId: config.courseId,
              employeeId: emp.id,
              status: 'ENROLLED',
              source: 'mandatory_auto',
              enrolledAt: new Date(),
              expiresAt,
            },
          })
          totalEnrolled++
        }
      }

      return apiSuccess({
        year,
        companyId: targetCompanyId,
        totalEnrolled,
        totalSkipped,
        configsProcessed: configs.length,
      })
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.TRAINING, ACTION.CREATE),
)
