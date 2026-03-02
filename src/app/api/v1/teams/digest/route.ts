// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET/POST /api/v1/teams/digest
// 다이제스트 미리보기 (GET) / 수동 트리거 (POST)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { generateDigestData } from '@/lib/teams-digest'
import { buildWeeklyDigestCard } from '@/lib/adaptive-cards'
import { postToChannel } from '@/lib/microsoft-graph'
import type { SessionUser } from '@/types'

// ─── GET — 다이제스트 미리보기 ──────────────────────────────

export const GET = withPermission(
  async (_req: NextRequest, _context, user: SessionUser) => {
    const data = await generateDigestData(user.companyId)
    const card = buildWeeklyDigestCard(data)

    return apiSuccess({ digest: data, card })
  },
  perm(MODULE.SETTINGS, ACTION.VIEW),
)

// ─── POST — 다이제스트 수동 전송 ────────────────────────────

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const integration = await prisma.teamsIntegration.findUnique({
      where: { companyId: user.companyId },
    })

    if (!integration?.teamId || !integration?.channelId) {
      return apiSuccess(
        { success: false, message: 'Teams 채널이 설정되지 않았습니다.' },
        200,
      )
    }

    const data = await generateDigestData(user.companyId)
    const card = buildWeeklyDigestCard(data)

    const result = await postToChannel(
      integration.teamId,
      integration.channelId,
      `주간 HR 다이제스트 (${data.weekRange})`,
      card,
    )

    const { ip, userAgent } = extractRequestMeta(req.headers)
    logAudit({
      actorId: user.employeeId,
      action: 'teams.digest.send',
      resourceType: 'teams_digest',
      resourceId: user.companyId,
      companyId: user.companyId,
      ip,
      userAgent,
    })

    return apiSuccess(result)
  },
  perm(MODULE.SETTINGS, ACTION.CREATE),
)
