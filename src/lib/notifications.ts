// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Notification Dispatcher (B11 강화)
// debounce(5분) + quiet hours + per-user prefs + 3채널
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma/client'
import { sendTeamsMessage } from '@/lib/microsoft-graph'
import { sendEmail } from '@/lib/email'
import { subMinutes } from 'date-fns'
import { resolveRecipientLocale, renderNotificationMessage } from '@/lib/notifications-i18n'

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface SendNotificationInput {
  employeeId: string
  triggerType: string
  /** 직접 지정 (레거시) — titleKey 사용 시 무시됨 */
  title: string
  /** 직접 지정 (레거시) — bodyKey 사용 시 무시됨 */
  body: string
  /** i18n 메시지 키 (예: 'notifications.leaveApproved.title') */
  titleKey?: string
  /** i18n 메시지 키 (예: 'notifications.leaveApproved.body') */
  bodyKey?: string
  /** bodyKey 내 {변수} 치환 파라미터 */
  bodyParams?: Record<string, string | number>
  link?: string
  priority?: NotificationPriority
  metadata?: Record<string, unknown>
  adaptiveCard?: Record<string, unknown>
  companyId?: string
}

// ─── Public API ───────────────────────────────────────────

/**
 * 알림을 fire-and-forget으로 발송합니다.
 * debounce(5분) + quiet hours + per-user prefs 지원
 */
export function sendNotification(input: SendNotificationInput): void {
  dispatchNotification(input).catch(() => {
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

// ─── Core Dispatcher ─────────────────────────────────────

async function dispatchNotification(input: SendNotificationInput): Promise<void> {
  const priority = input.priority ?? 'normal'

  // 0. i18n: titleKey/bodyKey가 있으면 수신자 locale 기반 렌더링
  let resolvedTitle = input.title
  let resolvedBody = input.body
  let resolvedHtmlBody: string | undefined

  if (input.titleKey && input.bodyKey) {
    const locale = await resolveRecipientLocale(input.employeeId)
    const rendered = await renderNotificationMessage(locale, {
      titleKey: input.titleKey,
      bodyKey: input.bodyKey,
      bodyParams: input.bodyParams,
    })
    resolvedTitle = rendered.title
    resolvedBody = rendered.body
    resolvedHtmlBody = rendered.htmlBody
  }

  // 1. 5분 debounce: 동일 type + employee, 5분 이내 중복 방지
  const recent = await prisma.notification.findFirst({
    where: {
      employeeId: input.employeeId,
      triggerType: input.triggerType,
      createdAt: { gte: subMinutes(new Date(), 5) },
    },
    select: { id: true },
  })
  if (recent) return

  // 2. 사용자 알림 설정 조회
  const prefs = await prisma.notificationPreference.findUnique({
    where: { employeeId: input.employeeId },
  })

  // 3. quiet hours 체크 (urgent는 예외)
  if (priority !== 'urgent' && prefs && isQuietHours(prefs)) {
    // Quiet hours 중이면 인앱만 (조용히 기록)
    await createInAppRecord(input, priority)
    return
  }

  // 4. 이벤트별 사용자 채널 설정 조회
  const eventPrefs = prefs
    ? ((prefs.preferences as Record<string, Record<string, boolean>>)[input.triggerType] ?? null)
    : null

  const inAppEnabled = eventPrefs?.in_app !== false   // default: true
  const emailEnabled = eventPrefs?.email === true     // default: false
  const teamsEnabled = eventPrefs?.teams === true     // default: false

  // 5. Trigger 설정 조회 (전역 채널 설정)
  const trigger = await prisma.notificationTrigger.findFirst({
    where: { eventType: input.triggerType, deletedAt: null },
    select: { channels: true },
  })
  const globalChannels: string[] = (trigger?.channels as string[]) ?? ['IN_APP']

  const promises: Promise<void>[] = []

  // i18n이 적용된 resolved 값으로 input 오버라이드
  const resolved = { ...input, title: resolvedTitle, body: resolvedBody }

  // 6. IN_APP
  if (inAppEnabled || globalChannels.includes('IN_APP')) {
    promises.push(createInAppRecord(resolved, priority))
  }

  // 7. EMAIL
  if (emailEnabled || globalChannels.includes('EMAIL')) {
    promises.push(sendEmailNotification(resolved, resolvedHtmlBody))
  }

  // 8. TEAMS (per-user 설정 또는 TeamsWebhookConfig)
  if (teamsEnabled || globalChannels.includes('TEAMS')) {
    promises.push(sendTeamsNotification(resolved, priority))
  }

  await Promise.allSettled(promises)
}

// ─── Quiet Hours ──────────────────────────────────────────

function isQuietHours(prefs: {
  quietHoursStart?: string | null
  quietHoursEnd?: string | null
  timezone?: string
}): boolean {
  if (!prefs.quietHoursStart || !prefs.quietHoursEnd) return false

  const now = new Date()
  const tz = prefs.timezone ?? 'Asia/Seoul'

  const timeStr = now.toLocaleTimeString('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const [nowH, nowM] = timeStr.split(':').map(Number)
  const [startH, startM] = prefs.quietHoursStart.split(':').map(Number)
  const [endH, endM] = prefs.quietHoursEnd.split(':').map(Number)

  const nowTotal = nowH * 60 + nowM
  const startTotal = startH * 60 + startM
  const endTotal = endH * 60 + endM

  if (startTotal <= endTotal) {
    return nowTotal >= startTotal && nowTotal < endTotal
  } else {
    // 자정 걸침 (예: 22:00 ~ 08:00)
    return nowTotal >= startTotal || nowTotal < endTotal
  }
}

// ─── IN_APP ───────────────────────────────────────────────

async function createInAppRecord(
  input: SendNotificationInput,
  priority: NotificationPriority,
): Promise<void> {
  await prisma.notification.create({
    data: {
      employeeId: input.employeeId,
      triggerType: input.triggerType,
      title: input.title,
      body: input.body,
      channel: 'IN_APP',
      link: input.link ?? null,
      priority,
      metadata: input.metadata != null ? (input.metadata as unknown as Prisma.InputJsonValue) : undefined,
      channels: ['IN_APP'],
    },
  })
}

// ─── EMAIL ────────────────────────────────────────────────

async function sendEmailNotification(input: SendNotificationInput, htmlOverride?: string): Promise<void> {
  const employee = await prisma.employee.findUnique({
    where: { id: input.employeeId },
    select: { email: true },
  })

  if (!employee?.email) return

  const bodyHtml = htmlOverride ?? `<p>${input.body}</p>`
  const linkHtml = input.link ? `<p><a href="${input.link}">View Details</a></p>` : ''

  await sendEmail({
    to: employee.email,
    subject: input.title,
    htmlBody: `${bodyHtml}${linkHtml}`,
  })
}

// ─── TEAMS ────────────────────────────────────────────────

async function sendTeamsNotification(
  input: SendNotificationInput,
  priority: NotificationPriority,
): Promise<void> {
  const promises: Promise<void>[] = []

  // 방법 1: 직접 DM (기존 SsoIdentity 기반)
  const ssoIdentity = await prisma.ssoIdentity.findFirst({
    where: { employeeId: input.employeeId, provider: 'azure-ad' },
    select: { providerAccountId: true },
  })

  if (ssoIdentity) {
    const card = buildSimpleAdaptiveCard(input, priority)
    promises.push(
      sendTeamsMessage(
        ssoIdentity.providerAccountId,
        `**${input.title}**\n\n${input.body}`,
        card,
      ).then(() => undefined),
    )
  }

  // 방법 2: Webhook 채널 (TeamsWebhookConfig 기반)
  if (input.companyId) {
    const webhooks = await prisma.teamsWebhookConfig.findMany({
      where: {
        companyId: input.companyId,
        deletedAt: null,
        eventTypes: { has: input.triggerType },
      },
    })

    for (const webhook of webhooks) {
      promises.push(postToWebhook(webhook.webhookUrl, input, priority))
    }
  }

  await Promise.allSettled(promises)
}

async function postToWebhook(
  webhookUrl: string,
  input: SendNotificationInput,
  priority: NotificationPriority,
): Promise<void> {
  const card = buildSimpleAdaptiveCard(input, priority)

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'message',
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: card,
        },
      ],
    }),
  })
}

function buildSimpleAdaptiveCard(
  input: SendNotificationInput,
  priority: NotificationPriority,
): Record<string, unknown> {
  const priorityColor: Record<NotificationPriority, string> = {
    urgent: 'Attention',
    high: 'Warning',
    normal: 'Default',
    low: 'Default',
  }

  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        text: `🔔 ${input.title}`,
        weight: 'Bolder',
        size: 'Medium',
        color: priorityColor[priority],
        wrap: true,
      },
      {
        type: 'TextBlock',
        text: input.body,
        wrap: true,
        color: 'Default',
      },
    ],
    actions: input.link
      ? [
          {
            type: 'Action.OpenUrl',
            title: 'HR Hub에서 확인',
            url: `${process.env.NEXTAUTH_URL ?? ''}${input.link}`,
          },
        ]
      : [],
  }
}
