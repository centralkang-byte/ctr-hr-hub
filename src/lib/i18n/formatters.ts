// ═══════════════════════════════════════════════════════════
// CTR HR Hub — i18n Formatters
// 법인별 날짜/통화/숫자 포맷팅
// ═══════════════════════════════════════════════════════════

const LOCALE_FORMAT_MAP: Record<string, { dateLocale: string; currency: string }> = {
  KR: { dateLocale: 'ko-KR', currency: 'KRW' },
  CN: { dateLocale: 'zh-CN', currency: 'CNY' },
  RU: { dateLocale: 'ru-RU', currency: 'RUB' },
  US: { dateLocale: 'en-US', currency: 'USD' },
  VN: { dateLocale: 'vi-VN', currency: 'VND' },
  MX: { dateLocale: 'es-MX', currency: 'MXN' },
}

function getFormatConfig(countryCode: string) {
  return LOCALE_FORMAT_MAP[countryCode] ?? LOCALE_FORMAT_MAP.US
}

export function formatCurrency(
  value: number,
  countryCode: string,
  options?: Intl.NumberFormatOptions,
): string {
  const config = getFormatConfig(countryCode)
  return new Intl.NumberFormat(config.dateLocale, {
    style: 'currency',
    currency: config.currency,
    maximumFractionDigits: config.currency === 'KRW' || config.currency === 'VND' ? 0 : 2,
    ...options,
  }).format(value)
}

export function formatDate(
  date: Date | string,
  countryCode: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const config = getFormatConfig(countryCode)
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat(config.dateLocale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...options,
  }).format(d)
}

export function formatNumber(
  value: number,
  countryCode: string,
  options?: Intl.NumberFormatOptions,
): string {
  const config = getFormatConfig(countryCode)
  return new Intl.NumberFormat(config.dateLocale, options).format(value)
}
