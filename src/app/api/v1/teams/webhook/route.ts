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

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-teams-signature')

  if (!verifyWebhookSignature(rawBody, signature)) {
    return apiError(unauthorized('인증 실패'))
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return apiError(badRequest('잘못된 JSON'))
  }

  const parsed = teamsCardActionSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(badRequest('잘못된 요청 데이터'))
  }

  const { action, cardType, referenceId } = parsed.data

  // cardAction 레코드에서 companyId와 actionBy를 조회
  const cardAction = await prisma.teamsCardAction.findFirst({
    where: { cardType, referenceId, actionTaken: null },
    select: { companyId: true, recipientId: true },
  })

  if (!cardAction) {
    return apiError(notFound('처리 가능한 카드 액션이 없습니다.'))
  }

  const result = await executeCardAction({
    cardType,
    referenceId,
    action,
    actionBy: cardAction.recipientId,
    companyId: cardAction.companyId,
  })

  // Teams Adaptive Card 콜백 — result 원형 그대로 반환
  return NextResponse.json(result, { status: result.success ? 200 : 400 })
}
