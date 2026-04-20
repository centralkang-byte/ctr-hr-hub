// ═══════════════════════════════════════════════════════════
// PATCH/DELETE /api/v1/settings/teams-webhooks/[id]
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess, apiError } from '@/lib/api'
import { notFound, badRequest } from '@/lib/errors'
import { getRequestLocale, serverT } from '@/lib/server-i18n'
import type { SessionUser } from '@/types'

// isActive is accepted (backward compat with UI/clients that still send it)
// but not a TeamsWebhookConfig column — the data spread at line 47-52 already
// filters it out. Removing it would, combined with .strict(), turn previously
// valid payloads into 400s. POST route's Zod schema has it removed since POST
// is non-strict and silently strips extras (Codex Gate 2 P2).
const webhookPatchSchema = z.object({
  channelName: z.string().min(1).max(200).optional(),
  webhookUrl: z.string().url().optional(),
  eventTypes: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
}).strict()

type RouteContext = { params: Promise<Record<string, string>> }

export const PATCH = withPermission(
  async (req: NextRequest, context: RouteContext, user: SessionUser) => {
    const { id } = await context.params
    const idParsed = z.string().uuid().safeParse(id)
    if (!idParsed.success) {
      const locale = await getRequestLocale()
      return apiError(badRequest(await serverT(locale, 'teams.api.invalidId')))
    }

    const body = await req.json()
    const parsed = webhookPatchSchema.safeParse(body)
    if (!parsed.success) return apiError(badRequest(parsed.error.issues.map(i => i.message).join(', ')))

    const existing = await prisma.teamsWebhookConfig.findFirst({
      where: { id, companyId: user.companyId },
    })
    if (!existing) {
      const locale = await getRequestLocale()
      throw notFound(await serverT(locale, 'teams.api.webhookNotFound'))
    }

    const updated = await prisma.teamsWebhookConfig.update({
      where: { id },
      data: {
        ...(parsed.data.channelName !== undefined ? { channelName: parsed.data.channelName } : {}),
        ...(parsed.data.webhookUrl !== undefined ? { webhookUrl: parsed.data.webhookUrl } : {}),
        ...(parsed.data.eventTypes !== undefined ? { eventTypes: parsed.data.eventTypes } : {}),
        
      },
    })

    return apiSuccess(updated)
  },
  perm(MODULE.SETTINGS, ACTION.UPDATE),
)

export const DELETE = withPermission(
  async (_req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const idParsed = z.string().uuid().safeParse(id)
    if (!idParsed.success) {
      const locale = await getRequestLocale()
      return apiError(badRequest(await serverT(locale, 'teams.api.invalidId')))
    }

    const existing = await prisma.teamsWebhookConfig.findFirst({
      where: { id, companyId: user.companyId },
    })
    if (!existing) {
      const locale = await getRequestLocale()
      throw notFound(await serverT(locale, 'teams.api.webhookNotFound'))
    }

    await prisma.teamsWebhookConfig.delete({ where: { id } })

    return apiSuccess({ deleted: true })
  },
  perm(MODULE.SETTINGS, ACTION.DELETE),
)
