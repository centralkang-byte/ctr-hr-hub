// WEBHOOK: secured by MS Teams webhook signature, not user session
// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/teams/recognition
// Teams Bot 경유 칭찬/인정 생성
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyBotSignature } from '@/lib/teams-bot'
import { teamsRecognitionSchema } from '@/lib/schemas/teams'
import { sendNotification } from '@/lib/notifications'
import { buildRecognitionCard } from '@/lib/adaptive-cards'
import { apiSuccess, apiError } from '@/lib/api'
import { unauthorized, badRequest, notFound } from '@/lib/errors'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'
import { getRequestLocale, serverT } from '@/lib/server-i18n'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const locale = await getRequestLocale()

  if (!verifyBotSignature(authHeader)) {
    return apiError(unauthorized(await serverT(locale, 'teams.api.authFailed')))
  }

  const body: unknown = await req.json()
  const parsed = teamsRecognitionSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(badRequest(await serverT(locale, 'teams.api.invalidRequest')))
  }

  const { receiverAadId, value, message } = parsed.data

  // 보내는 사람: Authorization 헤더에서 봇이 전달한 sender 정보
  const senderAadId = req.headers.get('x-teams-sender-aad-id')
  if (!senderAadId) {
    return apiError(badRequest(await serverT(locale, 'teams.api.senderMissing')))
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
    return apiError(notFound(await serverT(locale, 'teams.api.userNotRegistered')))
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const senderCompanyId = (extractPrimaryAssignment(sender.employee.assignments ?? []) as any)?.companyId as string | undefined

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
  const card = await buildRecognitionCard(locale, {
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
    titleKey: 'notifications.recognitionReceived.title',
    bodyKey: 'notifications.recognitionReceived.body',
    bodyParams: { senderName: sender.employee.name },
    link: '/performance/recognition',
    adaptiveCard: card,
  })

  return apiSuccess({ recognitionId: recognition.id })
}
