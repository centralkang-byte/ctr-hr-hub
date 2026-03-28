// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/settings/workflows/[id]/restore
// 소프트 삭제된 워크플로 규칙 복구
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { notFound, conflict, isAppError, handlePrismaError } from '@/lib/errors'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import type { SessionUser } from '@/types'

export const POST = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params

    try {
      const existing = await prisma.workflowRule.findFirst({
        where: { id, companyId: user.companyId, deletedAt: { not: null } },
      })
      if (!existing) throw notFound('삭제된 워크플로를 찾을 수 없습니다.')

      // unique constraint: (companyId, workflowType, name)
      const duplicate = await prisma.workflowRule.findFirst({
        where: {
          companyId: user.companyId,
          workflowType: existing.workflowType,
          name: existing.name,
          deletedAt: null,
          id: { not: id },
        },
      })
      if (duplicate) throw conflict(`동일한 이름의 워크플로가 이미 존재합니다: "${existing.name}"`)

      const restored = await prisma.workflowRule.update({
        where: { id },
        data: { deletedAt: null },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'settings.workflow_rule.restore',
        resourceType: 'workflowRule',
        resourceId: id,
        companyId: user.companyId,
        ip,
        userAgent,
      })

      return apiSuccess(restored)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.SETTINGS, ACTION.UPDATE),
)
