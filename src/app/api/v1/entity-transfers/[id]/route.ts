// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/entity-transfers/[id]
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound, forbidden } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/entity-transfers/[id] ───────────────────

export const GET = withPermission(
  async (
    _req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id } = await context.params

    const transfer = await prisma.entityTransfer.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            nameEn: true,
            employeeNo: true,
            email: true,
            assignments: {
              where: { isPrimary: true, endDate: null },
              take: 1,
              include: {
                department: { select: { id: true, name: true } },
                jobGrade: { select: { id: true, name: true } },
              },
            },
          },
        },
        fromCompany: { select: { id: true, name: true, code: true } },
        toCompany: { select: { id: true, name: true, code: true } },
        newDepartment: { select: { id: true, name: true } },
        newJobGrade: { select: { id: true, name: true } },
        requester: { select: { id: true, name: true } },
        fromApproverEmp: { select: { id: true, name: true } },
        toApproverEmp: { select: { id: true, name: true } },
        execApproverEmp: { select: { id: true, name: true } },
        dataLogs: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!transfer) {
      throw notFound('전환 요청을 찾을 수 없습니다.')
    }

    // Non-SUPER_ADMIN can only see transfers involving their company
    if (
      user.role !== 'SUPER_ADMIN' &&
      transfer.fromCompanyId !== user.companyId &&
      transfer.toCompanyId !== user.companyId
    ) {
      throw forbidden('이 전환 요청에 대한 접근 권한이 없습니다.')
    }

    return apiSuccess(transfer)
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)
