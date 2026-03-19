// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Delegation Revoke API
// PUT /api/v1/delegation/[id]/revoke → 대결 해제
// ═══════════════════════════════════════════════════════════

import { type NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'
import { eventBus } from '@/lib/events/event-bus'

function apiErr(opts: { status: number; message: string }) {
  return NextResponse.json(
    { error: { code: opts.status === 403 ? 'FORBIDDEN' : opts.status === 404 ? 'NOT_FOUND' : 'BAD_REQUEST', message: opts.message } },
    { status: opts.status },
  )
}

export const PUT = withPermission(
  async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id } = await context.params

    if (!id) {
      return apiErr({ status: 400, message: 'Delegation ID가 필요합니다.' })
    }

    // Find the delegation
    const delegation = await prisma.approvalDelegation.findUnique({
      where: { id },
    })

    if (!delegation) {
      return apiErr({ status: 404, message: '대결 설정을 찾을 수 없습니다.' })
    }

    // Only delegator or HR_ADMIN+ can revoke
    if (
      delegation.delegatorId !== user.employeeId &&
      !['HR_ADMIN', 'SUPER_ADMIN'].includes(user.role)
    ) {
      return apiErr({ status: 403, message: '해제 권한이 없습니다.' })
    }

    if (delegation.status !== 'ACTIVE') {
      return apiErr({ status: 400, message: '이미 해제되었거나 만료된 대결입니다.' })
    }

    // Revoke
    const updated = await prisma.approvalDelegation.update({
      where: { id },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
        revokedBy: user.employeeId,
      },
    })

    // Audit log
    const { ip, userAgent } = extractRequestMeta(req.headers)
    logAudit({
      actorId: user.employeeId,
      action: 'delegation.revoke',
      resourceType: 'Delegation',
      resourceId: id,
      companyId: updated.companyId,
      sensitivityLevel: 'HIGH',
      changes: { status: 'REVOKED', revokedBy: user.employeeId },
      ip,
      userAgent,
    })

    // Publish event
    void eventBus.publish('DELEGATION_ENDED', {
      delegationId: updated.id,
      delegatorId: updated.delegatorId,
      delegateeId: updated.delegateeId,
      companyId: updated.companyId,
      reason: 'REVOKED',
      endedAt: new Date().toISOString(),
    }).catch(console.error)

    return apiSuccess(updated)
  },
  perm(MODULE.LEAVE, ACTION.UPDATE),
)
