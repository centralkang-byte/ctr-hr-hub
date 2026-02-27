// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Notification Helpers (fire-and-forget)
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'

interface SendNotificationInput {
  employeeId: string
  triggerType: string
  title: string
  body: string
  link?: string
}

/**
 * 알림을 fire-and-forget으로 발송합니다.
 * DB에 notifications 레코드 생성 (FCM/SES 연동은 Phase 2)
 */
export function sendNotification(input: SendNotificationInput): void {
  prisma.notification
    .create({
      data: {
        employeeId: input.employeeId,
        triggerType: input.triggerType,
        title: input.title,
        body: input.body,
        channel: 'IN_APP',
        link: input.link ?? null,
      },
    })
    .catch(() => {
      // fire-and-forget: 알림 실패가 비즈니스 로직에 영향 없어야 함
    })
}

/**
 * 여러 직원에게 동시에 알림 발송
 */
export function sendNotifications(inputs: SendNotificationInput[]): void {
  for (const input of inputs) {
    sendNotification(input)
  }
}
