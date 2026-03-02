// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/teams/recognition
// Teams Bot 경유 칭찬/인정 생성
// ═══════════════════════════════════════════════════════════

import { type NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyBotSignature } from '@/lib/teams-bot'
import { teamsRecognitionSchema } from '@/lib/schemas/teams'
import { sendNotification } from '@/lib/notifications'
import { buildRecognitionCard } from '@/lib/adaptive-cards'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!verifyBotSignature(authHeader)) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 })
  }

  const body: unknown = await req.json()
  const parsed = teamsRecognitionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: '잘못된 요청 데이터', details: parsed.error.issues },
      { status: 400 },
    )
  }

  const { receiverAadId, value, message } = parsed.data

  // 보내는 사람: Authorization 헤더에서 봇이 전달한 sender 정보
  const senderAadId = req.headers.get('x-teams-sender-aad-id')
  if (!senderAadId) {
    return NextResponse.json(
      { error: '보내는 사람 정보가 없습니다.' },
      { status: 400 },
    )
  }

  // SsoIdentity로 Employee 매핑
  const [sender, receiver] = await Promise.all([
    prisma.ssoIdentity.findFirst({
      where: { providerAccountId: senderAadId, provider: 'azure-ad' },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            assignments: {
              where: { isPrimary: true, endDate: null },
              take: 1,
              select: { companyId: true },
            },
          },
        },
      },
    }),
    prisma.ssoIdentity.findFirst({
      where: { providerAccountId: receiverAadId, provider: 'azure-ad' },
      include: { employee: { select: { id: true, name: true } } },
    }),
  ])

  if (!sender?.employee || !receiver?.employee) {
    return NextResponse.json(
      { error: 'HR Hub에 등록되지 않은 사용자입니다.' },
      { status: 404 },
    )
  }

  const senderCompanyId = (sender.employee.assignments[0] as any)?.companyId as string | undefined // eslint-disable-line @typescript-eslint/no-explicit-any

  // Recognition 생성
  const recognition = await prisma.recognition.create({
    data: {
      companyId: senderCompanyId ?? '',
      senderId: sender.employee.id,
      receiverId: receiver.employee.id,
      coreValue: value,
      message,
    },
  })

  // 수신자에게 알림
  const card = buildRecognitionCard({
    senderName: sender.employee.name,
    receiverName: receiver.employee.name,
    value,
    message,
  })

  sendNotification({
    employeeId: receiver.employee.id,
    triggerType: 'recognition.received',
    title: `${sender.employee.name}님이 칭찬을 보냈습니다`,
    body: message,
    link: '/performance/recognition',
    adaptiveCard: card,
  })

  return NextResponse.json({ success: true, recognitionId: recognition.id })
}
