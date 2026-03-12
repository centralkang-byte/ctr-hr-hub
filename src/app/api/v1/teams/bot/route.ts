// WEBHOOK: secured by MS Teams webhook signature, not user session
// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/teams/bot
// Bot Framework Activity 수신 (시그니처 검증, 세션 인증 없음)
// ═══════════════════════════════════════════════════════════

import { type NextRequest, NextResponse } from 'next/server'
import { verifyBotSignature, routeBotCommand } from '@/lib/teams-bot'
import { botActivitySchema } from '@/lib/schemas/teams'
import { apiError } from '@/lib/api'
import { unauthorized, badRequest } from '@/lib/errors'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')

  if (!verifyBotSignature(authHeader)) {
    return apiError(unauthorized('인증 실패'))
  }

  const body: unknown = await req.json()

  const parsed = botActivitySchema.safeParse(body)
  if (!parsed.success) {
    return apiError(badRequest('잘못된 Activity 데이터'))
  }

  const activity = parsed.data

  // Bot Framework Activity 응답 — Teams 포맷 그대로 반환
  // conversationUpdate: 봇 설치 시 환영 메시지
  if (activity.type === 'conversationUpdate') {
    return NextResponse.json({
      type: 'message',
      text: 'CTR HR Hub Bot이 설치되었습니다. "도움" 또는 "help"를 입력해 보세요.',
    })
  }

  // message: 명령 라우팅
  if (activity.type === 'message') {
    const response = await routeBotCommand(activity)
    return NextResponse.json(response)
  }

  // invoke: Adaptive Card 액션 (value 포함)
  if (activity.type === 'invoke' && activity.value) {
    // invoke 타입은 webhook route에서 처리
    return NextResponse.json({ status: 200, body: {} })
  }

  return NextResponse.json({ type: 'message', text: '' })
}
