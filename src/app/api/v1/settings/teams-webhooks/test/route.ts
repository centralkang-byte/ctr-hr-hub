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

// SSRF 방어: Microsoft Teams webhook URL만 허용
const ALLOWED_WEBHOOK_HOSTS = [
  /\.webhook\.office\.com$/,
  /\.office365\.com$/,
  /\.logic\.azure\.com$/,
  /^outlook\.office\.com$/,
]

function isAllowedWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return false
    return ALLOWED_WEBHOOK_HOSTS.some((pattern) => pattern.test(parsed.hostname))
  } catch {
    return false
  }
}

export const POST = withPermission(
  async (req: NextRequest, _ctx, _user: SessionUser) => {
    const body = await req.json()
    const parsed = testWebhookSchema.safeParse(body)
    if (!parsed.success) return apiError(badRequest(parsed.error.issues.map(i => i.message).join(', ')))
    const { webhookUrl } = parsed.data

    if (!isAllowedWebhookUrl(webhookUrl)) {
      return apiError(badRequest('허용되지 않는 Webhook URL입니다. Microsoft Teams Webhook URL만 사용할 수 있습니다.'))
    }

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
