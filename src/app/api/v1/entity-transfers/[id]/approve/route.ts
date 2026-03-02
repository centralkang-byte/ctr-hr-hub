// ═══════════════════════════════════════════════════════════
// CTR HR Hub — PUT /api/v1/entity-transfers/[id]/approve
// Multi-step approval workflow for entity transfers
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, forbidden } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { entityTransferApproveSchema } from '@/lib/schemas/entity-transfer'
import type { SessionUser } from '@/types'

// Status transition map: currentStatus → nextStatus on approve
const APPROVAL_TRANSITIONS: Record<
  string,
  { nextStatus: string; approverField: string; timestampField: string }
> = {
  TRANSFER_REQUESTED: {
    nextStatus: 'FROM_APPROVED',
    approverField: 'fromApprover',
    timestampField: 'fromApprovedAt',
  },
  FROM_APPROVED: {
    nextStatus: 'TO_APPROVED',
    approverField: 'toApprover',
    timestampField: 'toApprovedAt',
  },
  TO_APPROVED: {
    nextStatus: 'EXEC_APPROVED',
    approverField: 'executiveApprover',
    timestampField: 'executiveApprovedAt',
  },
}

// ─── PUT /api/v1/entity-transfers/[id]/approve ───────────

export const PUT = withPermission(
  async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id } = await context.params

    const body: unknown = await req.json()
    const parsed = entityTransferApproveSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { action, cancellationReason } = parsed.data

    // Fetch current transfer
    const transfer = await prisma.entityTransfer.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        fromCompanyId: true,
        toCompanyId: true,
      },
    })

    if (!transfer) {
      throw notFound('전환 요청을 찾을 수 없습니다.')
    }

    const currentStatus = transfer.status as string

    // Validate that current status is approvable
    const transition = APPROVAL_TRANSITIONS[currentStatus]
    if (!transition) {
      throw badRequest(
        `현재 상태(${currentStatus})에서는 승인/반려할 수 없습니다.`,
      )
    }

    // Validate company access for non-SUPER_ADMIN
    if (user.role !== 'SUPER_ADMIN') {
      // TRANSFER_REQUESTED → from company HR approves
      if (
        currentStatus === 'TRANSFER_REQUESTED' &&
        user.companyId !== transfer.fromCompanyId
      ) {
        throw forbidden('출발 법인의 HR만 이 단계를 승인할 수 있습니다.')
      }
      // FROM_APPROVED → to company HR approves
      if (
        currentStatus === 'FROM_APPROVED' &&
        user.companyId !== transfer.toCompanyId
      ) {
        throw forbidden('도착 법인의 HR만 이 단계를 승인할 수 있습니다.')
      }
      // TO_APPROVED → executive approval (no company restriction but needs manage permission)
    }

    // Handle rejection at any step
    if (action === 'reject') {
      if (!cancellationReason) {
        throw badRequest('반려 시 사유를 입력해야 합니다.')
      }

      const rejected = await prisma.entityTransfer.update({
        where: { id },
        data: {
          status: 'TRANSFER_CANCELLED',
          cancellationReason,
          // Record who rejected and when in the current step's fields
          [transition.approverField]: user.employeeId,
          [transition.timestampField]: new Date(),
        },
        include: {
          employee: { select: { id: true, name: true, employeeNo: true } },
          fromCompany: { select: { id: true, name: true } },
          toCompany: { select: { id: true, name: true } },
        },
      })

      return apiSuccess(rejected)
    }

    // Handle approval — advance to next status
    const approved = await prisma.entityTransfer.update({
      where: { id },
      data: {
        status: transition.nextStatus as never,
        [transition.approverField]: user.employeeId,
        [transition.timestampField]: new Date(),
      },
      include: {
        employee: { select: { id: true, name: true, employeeNo: true } },
        fromCompany: { select: { id: true, name: true } },
        toCompany: { select: { id: true, name: true } },
      },
    })

    return apiSuccess(approved)
  },
  perm(MODULE.EMPLOYEES, ACTION.APPROVE),
)
