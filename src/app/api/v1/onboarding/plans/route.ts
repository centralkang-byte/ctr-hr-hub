// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/onboarding/plans
// HR_ADMIN이 API로 직접 온보딩 플랜 생성
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, conflict, forbidden, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'

const createPlanSchema = z.object({
  employeeId: z.string().uuid({ message: 'employeeId(UUID)는 필수입니다.' }),
  templateId: z.string().uuid().optional(),
  startDate: z.string().date().optional(),
  buddyId: z.string().uuid().optional(),
})

// ─── POST /api/v1/onboarding/plans ───────────────────────

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = createPlanSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { employeeId, templateId, startDate, buddyId } = parsed.data

    try {
      // 1. 직원 확인
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: {
          id: true,
          name: true,
          assignments: {
            where: { isPrimary: true, endDate: null },
            take: 1,
            select: { companyId: true },
          },
        },
      })
      if (!employee) throw notFound('직원을 찾을 수 없습니다.')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const empPrimaryCompanyId = (extractPrimaryAssignment(employee.assignments ?? []) as any)?.companyId ?? null

      // 멀티테넌트: 비-SUPER는 본인 법인 재직 직원에게만 온보딩 생성
      // (활성 primary 발령 없으면 empPrimaryCompanyId=null → 거부; 퇴직자·타법인 임의 ID 차단)
      if (user.role !== 'SUPER_ADMIN' && empPrimaryCompanyId !== user.companyId) {
        throw forbidden('본인 법인 소속 직원에게만 온보딩을 생성할 수 있습니다.')
      }
      const empCompanyId: string = empPrimaryCompanyId ?? user.companyId
      // buddyId 동일 법인 재직 검증
      if (buddyId) {
        const buddyOk = await prisma.employeeAssignment.findFirst({
          where: { employeeId: buddyId, companyId: empCompanyId, isPrimary: true, endDate: null },
          select: { employeeId: true },
        })
        if (!buddyOk) throw badRequest('버디는 동일 법인 소속이어야 합니다.')
      }

      // 2. 이미 진행 중인 온보딩 확인
      const existing = await prisma.employeeOnboarding.findFirst({
        where: {
          employeeId,
          status: { in: ['NOT_STARTED', 'IN_PROGRESS'] },
          planType: 'ONBOARDING',
        },
      })
      if (existing) {
        throw conflict('해당 직원에게 이미 진행 중인 온보딩 플랜이 있습니다.')
      }

      // 3. 템플릿 조회 (미지정 시 해당 법인 기본 템플릿)
      const template = templateId
        ? await prisma.onboardingTemplate.findFirst({
            where: { id: templateId, OR: [{ companyId: empCompanyId }, { companyId: null }] },
            include: { onboardingTasks: { orderBy: { sortOrder: 'asc' } } },
          })
        : await prisma.onboardingTemplate.findFirst({
            where: {
              OR: [
                { companyId: empCompanyId },
                { companyId: null },  // global default
              ],
              deletedAt: null,
              planType: 'ONBOARDING',
            },
            orderBy: { companyId: 'desc' },  // company-specific first
            include: { onboardingTasks: { orderBy: { sortOrder: 'asc' } } },
          })

      if (!template) throw notFound('사용 가능한 온보딩 템플릿을 찾을 수 없습니다.')

      // 4. 플랜 + 태스크 일괄 생성
      const effectiveStartDate = startDate ? new Date(startDate) : new Date()

      const onboarding = await prisma.employeeOnboarding.create({
        data: {
          employeeId,
          templateId: template.id,
          companyId: empCompanyId,
          buddyId: buddyId ?? null,
          planType: 'ONBOARDING',
          status: 'NOT_STARTED',
          startedAt: effectiveStartDate,
          tasks: {
            create: template.onboardingTasks.map((task) => ({
              taskId: task.id,
              status: 'PENDING',
              dueDate: new Date(
                effectiveStartDate.getTime() + task.dueDaysAfter * 24 * 60 * 60 * 1000,
              ),
            })),
          },
        },
        include: {
          tasks: {
            include: { task: { select: { title: true, category: true } } },
          },
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'onboarding.plan.create',
        resourceType: 'employeeOnboarding',
        resourceId: onboarding.id,
        companyId: empCompanyId,
        ip,
        userAgent,
      })

      return apiSuccess(onboarding, 201)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.ONBOARDING, ACTION.CREATE),
)
