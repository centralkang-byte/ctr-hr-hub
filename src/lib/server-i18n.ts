// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Server-Side i18n Utilities
// Shared helpers for server-side translation (API routes, exports, Teams)
//
// For notifications: use notifications-i18n.ts (recipient locale + bilingual compositing)
// For client components: use next-intl's useTranslations() hook
// ═══════════════════════════════════════════════════════════

import type { Locale } from '@/i18n/config'

// ─── Types ──────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Messages = Record<string, any>

// ─── Message Loading (module-level cache) ───────────────────

const messageCache = new Map<string, Messages>()

export async function loadMessages(locale: string): Promise<Messages> {
  if (messageCache.has(locale)) return messageCache.get(locale)!

  try {
    const mod = await import(`../../messages/${locale}.json`)
    const messages = mod.default as Messages
    messageCache.set(locale, messages)
    return messages
  } catch {
    // locale file missing → fallback to en
    if (locale !== 'en') return loadMessages('en')
    return {}
  }
}

// ─── Key Resolution ─────────────────────────────────────────

/**
 * Resolve a dotted key path against a nested messages object.
 * e.g., 'notifications.leaveApproved.title' → messages.notifications.leaveApproved.title
 */
export function resolveKey(messages: Messages, key: string): string | undefined {
  const parts = key.split('.')
  let current: unknown = messages
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return typeof current === 'string' ? current : undefined
}

// ─── Interpolation ──────────────────────────────────────────

/**
 * Replace {param} placeholders with provided values.
 */
export function interpolate(
  template: string,
  params?: Record<string, string | number>,
): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`))
}

// ─── Convenience: serverT ───────────────────────────────────

/**
 * Server-side translation: load locale messages and resolve a single key.
 * For API routes, export routes, Teams handlers, etc.
 */
export async function serverT(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>,
): Promise<string> {
  const messages = await loadMessages(locale)
  const value = resolveKey(messages, key)
  if (!value) return key // fallback to key itself
  return interpolate(value, params)
}

// ─── Request Locale (cookie-based) ──────────────────────────

/**
 * Read the user's UI locale from NEXT_LOCALE cookie.
 * For use in API routes where the requester's preferred locale matters
 * (e.g., Excel export column headers).
 *
 * Falls back to 'ko' if cookie is not available (cron/webhook context).
 */
export async function getRequestLocale(): Promise<Locale> {
  try {
    // Dynamic import to avoid build-time errors in non-Next.js contexts
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const raw = cookieStore.get('NEXT_LOCALE')?.value
    if (raw && ['ko', 'en', 'zh', 'vi', 'es'].includes(raw)) {
      return raw as Locale
    }
  } catch {
    // cookies() not available (cron/webhook context) — fall through
  }
  return 'ko'
}
