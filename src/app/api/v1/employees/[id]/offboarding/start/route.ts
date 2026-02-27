// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/employees/[id]/offboarding/start
// 퇴직(오프보딩) 프로세스를 시작합니다.
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, conflict } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { sendNotifications } from '@/lib/notifications'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'
import type { OffboardingTargetType } from '@/generated/prisma/enums'

// ─── Schema ──────────────────────────────────────────────

const startOffboardingSchema = z.object({
  resignType: z.enum(['VOLUNTARY', 'INVOLUNTARY', 'RETIREMENT', 'CONTRACT_END']),
  lastWorkingDate: z.string().datetime(),
  resignReasonCode: z.string().optional(),
  resignReasonDetail: z.string().optional(),
  handoverToId: z.string().uuid().optional(),
})

// ─── POST /api/v1/employees/[id]/offboarding/start ──────

export const POST = withPermission(
  async (req: NextRequest, ctx, user: SessionUser) => {
    const { id: employeeId } = await ctx.params

    // 1. Parse & validate body
    const body = await req.json()
    const parsed = startOffboardingSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청입니다.', { issues: parsed.error.issues })
    }

    const {
      resignType,
      lastWorkingDate,
      resignReasonCode,
      resignReasonDetail,
      handoverToId,
    } = parsed.data

    // 2. Find employee (must be ACTIVE, company-scoped)
    const employee = await prisma.employee.findFirst({
      where: {
        id: employeeId,
        status: 'ACTIVE',
        deletedAt: null,
        ...(user.role !== ROLE.SUPER_ADMIN ? { companyId: user.companyId } : {}),
      },
      include: { company: true },
    })

    if (!employee) {
      throw notFound('활성 상태의 직원을 찾을 수 없습니다.')
    }

    // 3. Check for existing in-progress offboarding
    const existingOffboarding = await prisma.employeeOffboarding.findFirst({
      where: { employeeId, status: 'IN_PROGRESS' },
    })

    if (existingOffboarding) {
      throw conflict('이미 진행 중인 퇴직 프로세스가 있습니다.')
    }

    // 4. Map resignType to OffboardingTargetType for checklist matching
    //    ResignType and OffboardingTargetType share the same 4 values
    const targetType = resignType as OffboardingTargetType

    // 5. Find matching active checklist
    const checklist = await prisma.offboardingChecklist.findFirst({
      where: {
        companyId: employee.companyId,
        targetType,
        isActive: true,
      },
      include: {
        offboardingTasks: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    })

    if (!checklist) {
      throw notFound(
        `'${resignType}' 유형에 해당하는 활성 오프보딩 체크리스트를 찾을 수 없습니다.`,
      )
    }

    // 6. Determine new employee status
    const newStatus = resignType === 'INVOLUNTARY' ? 'TERMINATED' : 'RESIGNED'
    const changeType = resignType === 'INVOLUNTARY' ? 'TERMINATE' : 'RESIGN'

    // 7. Run transaction
    const result = await prisma.$transaction(async (tx) => {
      // a) Update employee status & resignDate
      await tx.employee.update({
        where: { id: employeeId },
        data: {
          status: newStatus,
          resignDate: new Date(lastWorkingDate),
        },
      })

      // b) Create EmployeeHistory
      await tx.employeeHistory.create({
        data: {
          employeeId,
          changeType,
          effectiveDate: new Date(lastWorkingDate),
          reason: resignReasonDetail ?? resignReasonCode ?? `퇴직 유형: ${resignType}`,
          approvedBy: user.employeeId,
        },
      })

      // c) Create EmployeeOffboarding
      const offboarding = await tx.employeeOffboarding.create({
        data: {
          employeeId,
          checklistId: checklist.id,
          resignType,
          lastWorkingDate: new Date(lastWorkingDate),
          resignReasonCode: resignReasonCode ?? null,
          resignReasonDetail: resignReasonDetail ?? null,
          handoverToId: handoverToId ?? null,
          status: 'IN_PROGRESS',
          startedAt: new Date(),
        },
      })

      // d) Auto-create EmployeeOffboardingTask records
      if (checklist.offboardingTasks.length > 0) {
        await tx.employeeOffboardingTask.createMany({
          data: checklist.offboardingTasks.map((task) => ({
            employeeOffboardingId: offboarding.id,
            taskId: task.id,
            status: 'PENDING' as const,
          })),
        })
      }

      return offboarding
    })

    // 8. Fire-and-forget notifications
    const notifications = []

    // Notify manager
    if (employee.managerId) {
      notifications.push({
        employeeId: employee.managerId,
        triggerType: 'OFFBOARDING_START',
        title: '퇴직 프로세스 시작',
        body: `${employee.name}님의 퇴직 프로세스가 시작되었습니다. 최종 근무일: ${lastWorkingDate.split('T')[0]}`,
        link: `/offboarding`,
      })
    }

    // Notify handover person
    if (handoverToId) {
      notifications.push({
        employeeId: handoverToId,
        triggerType: 'OFFBOARDING_HANDOVER',
        title: '업무 인수 요청',
        body: `${employee.name}님의 업무를 인수해 주세요.`,
        link: `/offboarding`,
      })
    }

    if (notifications.length > 0) {
      sendNotifications(notifications)
    }

    // 9. Audit log
    const meta = extractRequestMeta(req.headers)
    logAudit({
      actorId: user.employeeId,
      action: 'OFFBOARDING_START',
      resourceType: 'EmployeeOffboarding',
      resourceId: result.id,
      companyId: employee.companyId,
      changes: {
        employeeId,
        resignType,
        lastWorkingDate,
        newStatus,
        checklistId: checklist.id,
        taskCount: checklist.offboardingTasks.length,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    })

    return apiSuccess(result, 201)
  },
  perm(MODULE.OFFBOARDING, ACTION.CREATE),
)
