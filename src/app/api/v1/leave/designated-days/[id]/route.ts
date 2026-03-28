// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Designated Leave Day Detail API
// DELETE /api/v1/leave/designated-days/[id]
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

export const DELETE = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params

    const existing = await prisma.designatedLeaveDay.findUnique({ where: { id } })
    if (!existing) throw notFound('지정연차를 찾을 수 없습니다.')

    // 소속 법인 확인 (SUPER_ADMIN이 아니면 자기 법인만)
    if (user.role !== 'SUPER_ADMIN' && existing.companyId !== user.companyId) {
      throw notFound('지정연차를 찾을 수 없습니다.')
    }

    await prisma.designatedLeaveDay.delete({ where: { id } })

    const meta = extractRequestMeta(req.headers)
    logAudit({
      actorId: user.employeeId,
      action: 'leave.designated_day.delete',
      resourceType: 'DesignatedLeaveDay',
      resourceId: id,
      companyId: existing.companyId,
      changes: { date: existing.date.toISOString().slice(0, 10), name: existing.name },
      ...meta,
    })

    return apiSuccess({ deleted: true })
  },
  perm(MODULE.LEAVE, ACTION.DELETE),
)
