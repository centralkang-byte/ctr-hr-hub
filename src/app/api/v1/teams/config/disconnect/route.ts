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
import { getRequestLocale, serverT } from '@/lib/server-i18n'
import type { SessionUser } from '@/types'

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const integration = await prisma.teamsIntegration.findUnique({
      where: { companyId: user.companyId },
    })

    if (!integration) {
      const locale = await getRequestLocale()
      return apiSuccess({ message: await serverT(locale, 'teams.api.noConfig') })
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

    const locale = await getRequestLocale()
    return apiSuccess({ message: await serverT(locale, 'teams.api.disconnected') })
  },
  perm(MODULE.SETTINGS, ACTION.UPDATE),
)
