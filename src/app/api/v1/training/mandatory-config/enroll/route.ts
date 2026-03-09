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
        if (employees.length === 0) continue

        const employeeIds = employees.map((e) => e.id)

        // 배치 조회로 N+1 제거: 해당 과정의 모든 등록 이력 한 번에 조회
        const existingEnrollments = await prisma.trainingEnrollment.findMany({
          where: {
            courseId: config.courseId,
            employeeId: { in: employeeIds },
          },
          select: {
            employeeId: true,
            status: true,
            expiresAt: true,
          },
        })

        const now = new Date()
        const completedSet = new Set<string>()
        const alreadyEnrolledSet = new Set<string>()

        for (const e of existingEnrollments) {
          alreadyEnrolledSet.add(e.employeeId)
          if (
            e.status === 'ENROLLMENT_COMPLETED' &&
            (!config.course.validityMonths || !e.expiresAt || e.expiresAt > now)
          ) {
            completedSet.add(e.employeeId)
          }
        }

        const deadlineMonth = config.deadlineMonth ?? 12
        const expiresAt = new Date(year, deadlineMonth - 1, 31)

        const toEnroll = employeeIds.filter(
          (id) => !completedSet.has(id) && !alreadyEnrolledSet.has(id),
        )

        if (toEnroll.length > 0) {
          await prisma.trainingEnrollment.createMany({
            data: toEnroll.map((employeeId) => ({
              courseId: config.courseId,
              employeeId,
              status: 'ENROLLED',
              source: 'mandatory_auto',
              enrolledAt: now,
              expiresAt,
            })),
            skipDuplicates: true,
          })
          totalEnrolled += toEnroll.length
        }

        totalSkipped += employeeIds.length - toEnroll.length
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
