// ═══════════════════════════════════════════════════════════
// PATCH/DELETE /api/v1/settings/teams-webhooks/[id]
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { notFound } from '@/lib/errors'
import type { SessionUser } from '@/types'

type RouteContext = { params: Promise<Record<string, string>> }

export const PATCH = withPermission(
  async (req: NextRequest, context: RouteContext, user: SessionUser) => {
    const { id } = await context.params
    const body = await req.json()

    const existing = await prisma.teamsWebhookConfig.findFirst({
      where: { id, companyId: user.companyId },
    })
    if (!existing) throw notFound('Webhook 설정을 찾을 수 없습니다.')

    const updated = await prisma.teamsWebhookConfig.update({
      where: { id },
      data: {
        ...(body.channelName !== undefined ? { channelName: body.channelName } : {}),
        ...(body.webhookUrl !== undefined ? { webhookUrl: body.webhookUrl } : {}),
        ...(body.eventTypes !== undefined ? { eventTypes: body.eventTypes } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      },
    })

    return apiSuccess(updated)
  },
  perm(MODULE.SETTINGS, ACTION.UPDATE),
)

export const DELETE = withPermission(
  async (_req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params

    const existing = await prisma.teamsWebhookConfig.findFirst({
      where: { id, companyId: user.companyId },
    })
    if (!existing) throw notFound('Webhook 설정을 찾을 수 없습니다.')

    await prisma.teamsWebhookConfig.delete({ where: { id } })

    return apiSuccess({ deleted: true })
  },
  perm(MODULE.SETTINGS, ACTION.DELETE),
)
