// ═══════════════════════════════════════════════════════════
// POST /api/v1/settings/teams-webhooks/test — 테스트 카드 전송
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess, apiError } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import type { SessionUser } from '@/types'

const testWebhookSchema = z.object({
  webhookUrl: z.string().url(),
}).strict()

export const POST = withPermission(
  async (req: NextRequest, _ctx, _user: SessionUser) => {
    const body = await req.json()
    const parsed = testWebhookSchema.safeParse(body)
    if (!parsed.success) return apiError(badRequest(parsed.error.issues.map(i => i.message).join(', ')))
    const { webhookUrl } = parsed.data

    const testCard = {
      type: 'message',
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: {
            type: 'AdaptiveCard',
            $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
            version: '1.4',
            body: [
              {
                type: 'TextBlock',
                text: '🔔 CTR HR Hub — 테스트 알림',
                weight: 'Bolder',
                size: 'Medium',
              },
              {
                type: 'TextBlock',
                text: 'Teams Webhook이 정상적으로 연결되었습니다.',
                wrap: true,
              },
            ],
          },
        },
      ],
    }

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testCard),
      })

      return apiSuccess({ success: res.ok, status: res.status })
    } catch {
      return apiSuccess({ success: false, error: '전송 실패' })
    }
  },
  perm(MODULE.SETTINGS, ACTION.CREATE),
)
