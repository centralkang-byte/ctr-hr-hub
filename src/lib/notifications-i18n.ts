// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Notification i18n Renderer
// 수신자 locale 기반 다국어 알림 합본 렌더링
// 한국어 사용자: ko 1건
// 비한국어 사용자: en + 현지어 합본 1건
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import type { Locale } from '@/i18n/config'

// ─── Types ───────────────────────────────────────────────

export interface NotificationMessageKey {
  titleKey: string
  bodyKey: string
  bodyParams?: Record<string, string | number>
}

export interface RenderedMessage {
  title: string
  body: string
  htmlBody: string
}

// ─── Locale Resolution ──────────────────────────────────

/**
 * 수신자 locale 결정: Employee.locale → Company.locale → 'ko'
 */
export async function resolveRecipientLocale(employeeId: string): Promise<Locale> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      locale: true,
      assignments: {
        where: { isPrimary: true, endDate: null },
        take: 1,
        select: {
          company: { select: { locale: true } },
        },
      },
    },
  })

  if (employee?.locale) return employee.locale as Locale
  if (employee?.assignments[0]?.company?.locale) {
    return employee.assignments[0].company.locale as Locale
  }
  return 'ko'
}

// ─── Message Loading ────────────────────────────────────

type Messages = Record<string, Record<string, string>>

const messageCache = new Map<string, Messages>()

async function loadMessages(locale: string): Promise<Messages> {
  if (messageCache.has(locale)) return messageCache.get(locale)!

  try {
    const mod = await import(`../../messages/${locale}.json`)
    const messages = mod.default as Messages
    messageCache.set(locale, messages)
    return messages
  } catch {
    // locale 파일이 없으면 en fallback
    if (locale !== 'en') return loadMessages('en')
    return {}
  }
}

function resolveKey(messages: Messages, key: string): string | undefined {
  // key: "notifications.leaveApproved.title" → messages.notifications.leaveApproved.title
  const parts = key.split('.')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = messages
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined
    current = current[part]
  }
  return typeof current === 'string' ? current : undefined
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`))
}

// ─── Render ─────────────────────────────────────────────

/**
 * locale 1개에 대한 메시지 렌더링
 */
async function renderForLocale(
  locale: string,
  keys: NotificationMessageKey,
): Promise<{ title: string; body: string } | null> {
  const messages = await loadMessages(locale)
  const title = resolveKey(messages, keys.titleKey)
  const body = resolveKey(messages, keys.bodyKey)

  if (!title || !body) return null

  return {
    title: interpolate(title, keys.bodyParams),
    body: interpolate(body, keys.bodyParams),
  }
}

/**
 * 수신자 locale 기반 합본 메시지 렌더링
 * - ko 사용자: 한국어 1건
 * - 비 ko 사용자: 영어 + 현지어 합본 (현지어가 en이면 영어만)
 */
export async function renderNotificationMessage(
  recipientLocale: Locale,
  keys: NotificationMessageKey,
): Promise<RenderedMessage> {
  if (recipientLocale === 'ko') {
    const ko = await renderForLocale('ko', keys)
    if (ko) {
      return {
        title: ko.title,
        body: ko.body,
        htmlBody: `<p>${ko.body}</p>`,
      }
    }
  }

  // 비한국어: en + 현지어 합본
  const en = await renderForLocale('en', keys)

  if (recipientLocale === 'en' || !en) {
    // 영어 사용자이거나 en 번역 실패 시
    const resolved = en ?? { title: keys.titleKey, body: keys.bodyKey }
    return {
      title: resolved.title,
      body: resolved.body,
      htmlBody: `<p>${resolved.body}</p>`,
    }
  }

  const local = await renderForLocale(recipientLocale, keys)

  if (!local) {
    // 현지어 번역 없으면 영어만
    return {
      title: en.title,
      body: en.body,
      htmlBody: `<p>${en.body}</p>`,
    }
  }

  // 합본: 영어 + 현지어
  return {
    title: `${en.title} / ${local.title}`,
    body: `${en.body}\n\n${local.body}`,
    htmlBody: `<p>${en.body}</p><hr style="border:none;border-top:1px solid #eee;margin:12px 0"><p>${local.body}</p>`,
  }
}
