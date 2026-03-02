// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/teams/webhook
// Adaptive Card 액션 콜백 (HMAC 검증, 세션 인증 없음)
// ═══════════════════════════════════════════════════════════

import { type NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature } from '@/lib/teams-bot'
import { executeCardAction } from '@/lib/teams-actions'
import { teamsCardActionSchema } from '@/lib/schemas/teams'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-teams-signature')

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 })
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: '잘못된 JSON' }, { status: 400 })
  }

  const parsed = teamsCardActionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: '잘못된 요청 데이터', details: parsed.error.issues },
      { status: 400 },
    )
  }

  const { action, cardType, referenceId } = parsed.data

  // cardAction 레코드에서 companyId와 actionBy를 조회
  const cardAction = await prisma.teamsCardAction.findFirst({
    where: { cardType, referenceId, actionTaken: null },
    select: { companyId: true, recipientId: true },
  })

  if (!cardAction) {
    return NextResponse.json(
      { error: '처리 가능한 카드 액션이 없습니다.' },
      { status: 404 },
    )
  }

  const result = await executeCardAction({
    cardType,
    referenceId,
    action,
    actionBy: cardAction.recipientId,
    companyId: cardAction.companyId,
  })

  return NextResponse.json(result, { status: result.success ? 200 : 400 })
}
