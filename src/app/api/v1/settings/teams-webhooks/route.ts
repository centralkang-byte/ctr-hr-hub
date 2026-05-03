// ═══════════════════════════════════════════════════════════
// GET/POST /api/v1/settings/teams-webhooks
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { z } from 'zod'
import { getRequestLocale, serverT } from '@/lib/server-i18n'
import type { SessionUser } from '@/types'

// TeamsWebhookConfig Prisma model has no isActive column (see schema.prisma
// model TeamsWebhookConfig). Accepting isActive in Zod then spreading to
// prisma.create produced a Prisma error → 500. PATCH route already drops it
// in its data spread for the same reason. Drop from POST schema too — Zod is
// non-strict so clients sending isActive still validate (field silently
// ignored).
const webhookSchema = z.object({
  channelName: z.string().min(1).max(100),
  webhookUrl: z.string().url().max(500),
  eventTypes: z.array(z.string()).default([]),
})

export const GET = withPermission(
  async (_req: NextRequest, _ctx, user: SessionUser) => {
    const webhooks = await prisma.teamsWebhookConfig.findMany({
      where: { companyId: user.companyId },
      orderBy: { createdAt: 'desc' },
    })

    // webhookUrl 마스킹 (마지막 3자 → ***)
    const masked = webhooks.map((w) => ({
      ...w,
      webhookUrl:
        w.webhookUrl.length > 10
          ? w.webhookUrl.slice(0, -3) + '***'
          : '***',
    }))

    return apiSuccess(masked)
  },
  perm(MODULE.SETTINGS, ACTION.VIEW),
)

export const POST = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      throw badRequest('요청 본문이 올바른 JSON 형식이 아닙니다.')
    }
    const parsed = webhookSchema.safeParse(body)
    if (!parsed.success) {
      const locale = await getRequestLocale()
      throw badRequest(await serverT(locale, 'teams.api.invalidRequestData'))
    }

    try {
      const webhook = await prisma.teamsWebhookConfig.create({
        data: { ...parsed.data, companyId: user.companyId },
      })
      return apiSuccess(webhook)
    } catch (e) {
      throw handlePrismaError(e)
    }
  },
  perm(MODULE.SETTINGS, ACTION.CREATE),
)
