// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET/PUT /api/v1/teams/config
// TeamsIntegration 조회/수정 (SETTINGS 권한)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { teamsConfigSchema } from '@/lib/schemas/teams'
import type { SessionUser } from '@/types'

// ─── GET — TeamsIntegration 조회 ────────────────────────────

export const GET = withPermission(
  async (_req: NextRequest, _context, user: SessionUser) => {
    const integration = await prisma.teamsIntegration.findUnique({
      where: { companyId: user.companyId },
    })

    return apiSuccess(integration)
  },
  perm(MODULE.SETTINGS, ACTION.VIEW),
)

// ─── PUT — TeamsIntegration 수정 ────────────────────────────

export const PUT = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = teamsConfigSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    try {
      const result = await prisma.teamsIntegration.upsert({
        where: { companyId: user.companyId },
        create: {
          companyId: user.companyId,
          tenantId: parsed.data.tenantId ?? '',
          teamId: parsed.data.teamId ?? null,
          channelId: parsed.data.channelId ?? null,
          webhookUrl: parsed.data.webhookUrl ?? null,
          botEnabled: parsed.data.botEnabled ?? false,
          presenceSync: parsed.data.presenceSync ?? false,
          digestEnabled: parsed.data.digestEnabled ?? false,
          digestDay: parsed.data.digestDay ?? 1,
          digestHour: parsed.data.digestHour ?? 9,
          connectedAt: new Date(),
          connectedBy: user.employeeId,
        },
        update: {
          ...parsed.data,
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      // webhookUrl은 채널 쓰기 권한을 가진 민감 데이터이므로 감사 로그에서 제거
      const { webhookUrl: _webhookUrl, ...safeChanges } = parsed.data
      logAudit({
        actorId: user.employeeId,
        action: 'settings.teams.update',
        resourceType: 'teams_integration',
        resourceId: result.id,
        companyId: user.companyId,
        changes: safeChanges,
        ip,
        userAgent,
      })

      return apiSuccess(result)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.SETTINGS, ACTION.UPDATE),
)
