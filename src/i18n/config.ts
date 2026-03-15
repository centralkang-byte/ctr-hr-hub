// ═══════════════════════════════════════════════════════════
// CTR HR Hub — i18n Configuration
// Supported locales: ko, en, zh, vi, es (Q-5 global deployment)
// ═══════════════════════════════════════════════════════════

export const locales = ['ko', 'en', 'zh', 'vi', 'es'] as const

export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'en'

export const localeNames: Record<Locale, string> = {
  ko: '한국어',
  en: 'English',
  zh: '中文',
  vi: 'Tiếng Việt',
  es: 'Español',
}

export const localeFlags: Record<Locale, string> = {
  ko: '🇰🇷',
  en: '🇺🇸',
  zh: '🇨🇳',
  vi: '🇻🇳',
  es: '🇲🇽',
}
