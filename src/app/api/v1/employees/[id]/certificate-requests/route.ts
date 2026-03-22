// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/employees/[id]/certificate-requests
// HR Admin: 특정 직원의 증명서 요청 목록
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (
    _req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id } = await context.params

    // 직원 존재 확인 (회사 범위)
    const employeeCheck = await prisma.employee.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(user.role !== 'SUPER_ADMIN'
          ? { assignments: { some: { companyId: user.companyId, isPrimary: true, endDate: null } } }
          : {}),
      },
      select: { id: true },
    })
    if (!employeeCheck) throw notFound('직원을 찾을 수 없습니다.')

    const requests = await prisma.certificateRequest.findMany({
      where: { employeeId: id },
      include: {
        employee: { select: { id: true, name: true, employeeNo: true } },
        approver: { select: { id: true, name: true } },
      },
      orderBy: { requestedAt: 'desc' },
    })

    return apiSuccess(requests)
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)
