// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/teams/config/disconnect
// Teams 연결 해제 (SETTINGS 권한)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const integration = await prisma.teamsIntegration.findUnique({
      where: { companyId: user.companyId },
    })

    if (!integration) {
      return apiSuccess({ message: '연결된 Teams 설정이 없습니다.' })
    }

    await prisma.teamsIntegration.delete({
      where: { companyId: user.companyId },
    })

    const { ip, userAgent } = extractRequestMeta(req.headers)
    logAudit({
      actorId: user.employeeId,
      action: 'settings.teams.disconnect',
      resourceType: 'teams_integration',
      resourceId: integration.id,
      companyId: user.companyId,
      ip,
      userAgent,
    })

    return apiSuccess({ message: 'Teams 연결이 해제되었습니다.' })
  },
  perm(MODULE.SETTINGS, ACTION.UPDATE),
)
