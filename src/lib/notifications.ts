// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Notification Helpers (multi-channel dispatcher)
// IN_APP / EMAIL / TEAMS 3채널 fire-and-forget 발송
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { sendTeamsMessage } from '@/lib/microsoft-graph'
import { sendEmail } from '@/lib/email'

interface SendNotificationInput {
  employeeId: string
  triggerType: string
  title: string
  body: string
  link?: string
  adaptiveCard?: Record<string, unknown>
}

/**
 * 알림을 fire-and-forget으로 발송합니다.
 * triggerType에 매핑된 NotificationTrigger의 channels를 조회하여
 * IN_APP / EMAIL / TEAMS 채널별로 분기 발송합니다.
 */
export function sendNotification(input: SendNotificationInput): void {
  dispatchNotification(input).catch(() => {
    // fire-and-forget: 알림 실패가 비즈니스 로직에 영향 없어야 함
  })
}

async function dispatchNotification(input: SendNotificationInput): Promise<void> {
  // 1. trigger channels 조회
  const trigger = await prisma.notificationTrigger.findFirst({
    where: {
      eventType: input.triggerType,
      isActive: true,
    },
    select: { channels: true },
  })

  const channels: string[] = (trigger?.channels as string[]) ?? ['IN_APP']

  // 2. 채널별 발송
  const promises: Promise<void>[] = []

  if (channels.includes('IN_APP')) {
    promises.push(sendInAppNotification(input))
  }

  if (channels.includes('EMAIL')) {
    promises.push(sendEmailNotification(input))
  }

  if (channels.includes('TEAMS')) {
    promises.push(sendTeamsNotification(input))
  }

  await Promise.allSettled(promises)
}

// ─── IN_APP ─────────────────────────────────────────────────

async function sendInAppNotification(input: SendNotificationInput): Promise<void> {
  await prisma.notification.create({
    data: {
      employeeId: input.employeeId,
      triggerType: input.triggerType,
      title: input.title,
      body: input.body,
      channel: 'IN_APP',
      link: input.link ?? null,
    },
  })
}

// ─── EMAIL ──────────────────────────────────────────────────

async function sendEmailNotification(input: SendNotificationInput): Promise<void> {
  const employee = await prisma.employee.findUnique({
    where: { id: input.employeeId },
    select: { email: true },
  })

  if (!employee?.email) return

  await sendEmail({
    to: employee.email,
    subject: input.title,
    htmlBody: `<p>${input.body}</p>${input.link ? `<p><a href="${input.link}">자세히 보기</a></p>` : ''}`,
  })

  await prisma.notification.create({
    data: {
      employeeId: input.employeeId,
      triggerType: input.triggerType,
      title: input.title,
      body: input.body,
      channel: 'EMAIL',
      link: input.link ?? null,
    },
  })
}

// ─── TEAMS ──────────────────────────────────────────────────

async function sendTeamsNotification(input: SendNotificationInput): Promise<void> {
  // SsoIdentity로 AAD ID 조회
  const ssoIdentity = await prisma.ssoIdentity.findFirst({
    where: {
      employeeId: input.employeeId,
      provider: 'azure-ad',
    },
    select: { providerAccountId: true },
  })

  if (!ssoIdentity) return

  const result = await sendTeamsMessage(
    ssoIdentity.providerAccountId,
    `**${input.title}**\n\n${input.body}`,
    input.adaptiveCard,
  )

  if (result.success) {
    await prisma.notification.create({
      data: {
        employeeId: input.employeeId,
        triggerType: input.triggerType,
        title: input.title,
        body: input.body,
        channel: 'TEAMS',
        link: input.link ?? null,
      },
    })
  }
}

/**
 * 여러 직원에게 동시에 알림 발송
 */
export function sendNotifications(inputs: SendNotificationInput[]): void {
  for (const input of inputs) {
    sendNotification(input)
  }
}
