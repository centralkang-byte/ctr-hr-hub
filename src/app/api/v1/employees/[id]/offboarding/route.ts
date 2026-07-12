// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/employees/:id/offboarding
// 직원 상세 페이지용 퇴직 처리 정보 조회
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { getActiveTeamMemberIds, OFFBOARDING_TEAM_STATUSES } from '@/lib/employee/direct-reports'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (_req: NextRequest, ctx, user: SessionUser) => {
    const { id: employeeId } = await ctx.params

    // ⑥-C PR-2: MANAGER(비-HR/비-SUPER)는 본인 또는 직속부하만 (목록과 동일 스코프)
    const isHrOrSuper = user.role === ROLE.SUPER_ADMIN || user.role === ROLE.HR_ADMIN
    if (!isHrOrSuper && employeeId !== user.employeeId) {
      const teamIds = await getActiveTeamMemberIds(user.employeeId, user.companyId, OFFBOARDING_TEAM_STATUSES)
      if (!teamIds.includes(employeeId)) {
        throw notFound('퇴직 처리 정보를 찾을 수 없습니다.')
      }
    }

    const offboarding = await prisma.employeeOffboarding.findFirst({
      where: {
        employeeId,
        // 테넌트 스코핑 = EmployeeOffboarding.companyId 직접 (완료 퇴사도 직원 상세에서 조회 가능)
        ...(user.role !== 'SUPER_ADMIN' ? { companyId: user.companyId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        checklist: { select: { id: true, name: true } },
        offboardingTasks: {
          include: {
            task: {
              select: {
                id: true,
                title: true,
                description: true,
                assigneeType: true,
                dueDaysBefore: true,
                isRequired: true,
                sortOrder: true,
              },
            },
          },
          orderBy: { task: { sortOrder: 'asc' } },
        },
        handoverTo: { select: { id: true, name: true } },
      },
    })

    if (!offboarding) throw notFound('퇴직 처리 정보를 찾을 수 없습니다.')

    // ⑥-C PR-2: 사유 상세·재고용 불가는 HR 전용 마스킹 (instances/[id]와 동일 정책)
    return apiSuccess(
      isHrOrSuper
        ? offboarding
        : {
            ...offboarding,
            resignReasonCode: null,
            resignReasonDetail: null,
            isDoNotRehire: null,
            doNotRehireReason: null,
          },
    )
  },
  perm(MODULE.OFFBOARDING, ACTION.VIEW),
)
