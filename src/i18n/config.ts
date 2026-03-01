// ═══════════════════════════════════════════════════════════
// CTR HR Hub — i18n Configuration
// ═══════════════════════════════════════════════════════════

export const locales = ['ko', 'en', 'zh', 'ru', 'vi', 'es', 'pt'] as const

export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'en'

export const localeNames: Record<Locale, string> = {
  ko: '한국어',
  en: 'English',
  zh: '中文',
  ru: 'Русский',
  vi: 'Tiếng Việt',
  es: 'Español',
  pt: 'Português',
}

export const localeFlags: Record<Locale, string> = {
  ko: '🇰🇷',
  en: '🇺🇸',
  zh: '🇨🇳',
  ru: '🇷🇺',
  vi: '🇻🇳',
  es: '🇲🇽',
  pt: '🇧🇷',
}
