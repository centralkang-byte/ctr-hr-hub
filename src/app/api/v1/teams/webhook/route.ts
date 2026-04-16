// WEBHOOK: secured by MS Teams webhook signature, not user session
// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/teams/webhook
// Adaptive Card 액션 콜백 (HMAC 검증, 세션 인증 없음)
// ═══════════════════════════════════════════════════════════

import { type NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature } from '@/lib/teams-bot'
import { executeCardAction } from '@/lib/teams-actions'
import { teamsCardActionSchema } from '@/lib/schemas/teams'
import { prisma } from '@/lib/prisma'
import { apiError } from '@/lib/api'
import { unauthorized, badRequest, notFound } from '@/lib/errors'
import { getRequestLocale, serverT } from '@/lib/server-i18n'

export async function POST(req: NextRequest) {
  const locale = await getRequestLocale()
  const rawBody = await req.text()
  const signature = req.headers.get('x-teams-signature')

  if (!verifyWebhookSignature(rawBody, signature)) {
    return apiError(unauthorized(await serverT(locale, 'teams.api.authFailed')))
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return apiError(badRequest(await serverT(locale, 'teams.api.invalidJson')))
  }

  const parsed = teamsCardActionSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(badRequest(await serverT(locale, 'teams.api.invalidRequest')))
  }

  const { action, cardType, referenceId } = parsed.data

  // cardAction 레코드에서 companyId와 actionBy를 조회
  const cardAction = await prisma.teamsCardAction.findFirst({
    where: { cardType, referenceId, actionTaken: null },
    select: { companyId: true, recipientId: true },
  })

  if (!cardAction) {
    return apiError(notFound(await serverT(locale, 'teams.actions.recorded')))
  }

  const result = await executeCardAction(locale, {
    cardType,
    referenceId,
    action,
    actionBy: cardAction.recipientId,
    companyId: cardAction.companyId,
  })

  // Teams Adaptive Card 콜백 — result 원형 그대로 반환
  return NextResponse.json(result, { status: result.success ? 200 : 400 })
}
