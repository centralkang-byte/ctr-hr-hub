// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Leave Request Detail API
// GET /api/v1/leave/requests/[id]
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params

    const request = await prisma.leaveRequest.findFirst({
      where: {
        id,
        employeeId: user.employeeId,
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeNo: true,
            jobGrade: { select: { name: true } },
            departmentId: true,
          },
        },
        policy: {
          select: {
            id: true,
            name: true,
            leaveType: true,
            isPaid: true,
            minUnit: true,
          },
        },
        approver: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!request) {
      throw notFound('휴가 신청을 찾을 수 없습니다.')
    }

    return apiSuccess(request)
  },
  perm(MODULE.LEAVE, ACTION.VIEW),
)
