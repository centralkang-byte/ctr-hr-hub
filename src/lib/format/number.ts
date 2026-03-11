/**
 * Number formatting utilities — Art.12
 * Used across all 152 pages for consistent number display.
 */

/** 3200000 → "3,200,000" */
export function formatNumber(value: number | null | undefined): string {
  if (value == null) return '-'
  return new Intl.NumberFormat('ko-KR').format(value)
}

/** 3200000, 'KRW' → "₩3,200,000" */
export function formatCurrency(
  value: number | null | undefined,
  currency: string = 'KRW',
): string {
  if (value == null) return '-'
  const symbols: Record<string, string> = {
    KRW: '₩', USD: '$', CNY: '¥', VND: '₫', RUB: '₽', MXN: '$',
  }
  const symbol = symbols[currency] || currency + ' '
  return `${symbol}${formatNumber(value)}`
}

/** 2100000000 → "₩21억", 3200000 → "₩320만" */
export function formatCompact(
  value: number | null | undefined,
  currency: string = 'KRW',
): string {
  if (value == null) return '-'
  const symbols: Record<string, string> = {
    KRW: '₩', USD: '$', CNY: '¥', VND: '₫', RUB: '₽', MXN: '$',
  }
  const symbol = symbols[currency] || ''
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1_0000_0000) return `${sign}${symbol}${(abs / 1_0000_0000).toFixed(1).replace(/\.0$/, '')}억`
  if (abs >= 1_0000) return `${sign}${symbol}${(abs / 1_0000).toFixed(0)}만`
  return `${sign}${symbol}${formatNumber(abs)}`
}

/** 0.156 → "15.6%" */
export function formatPercent(
  value: number | null | undefined,
  decimals: number = 1,
): string {
  if (value == null) return '-'
  return `${(value * 100).toFixed(decimals)}%`
}

/** 15.6 → "15.6%" (already percentage, not ratio) */
export function formatPercentRaw(
  value: number | null | undefined,
  decimals: number = 1,
): string {
  if (value == null) return '-'
  return `${value.toFixed(decimals)}%`
}
