// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 법인별 언어 설정
// ═══════════════════════════════════════════════════════════

import type { Locale } from '@/i18n/config'

interface CompanyLocales {
  main: Locale
  sub: Locale | null
}

export function getCompanyLocales(countryCode: string): CompanyLocales {
  switch (countryCode) {
    case 'KR': return { main: 'ko', sub: 'en' }
    case 'US': return { main: 'en', sub: null }
    case 'CN': return { main: 'en', sub: 'zh' }
    case 'RU': return { main: 'en', sub: 'ru' }
    case 'VN': return { main: 'en', sub: 'vi' }
    case 'MX': return { main: 'en', sub: 'es' }
    default:   return { main: 'en', sub: null }
  }
}

export function getAvailableLocales(countryCode: string): Locale[] {
  const { main, sub } = getCompanyLocales(countryCode)
  if (sub) return [main, sub]
  return [main]
}
