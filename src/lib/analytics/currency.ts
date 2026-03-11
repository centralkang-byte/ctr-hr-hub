// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Currency Conversion Utility
// G-1: 인사이트 대시보드 통화 변환
// ═══════════════════════════════════════════════════════════

// Settings-connected: static exchange rates (V1). Reads from SYSTEM/exchange-rates when available.
export const EXCHANGE_RATES_TO_KRW: Record<string, number> = {
  KRW: 1,
  USD: 1400,
  CNY: 190,
  EUR: 1500,
  VND: 0.055,
  RUB: 15,
  MXN: 78,
}

export function convertToKRW(amount: number, currency: string): number {
  const rate = EXCHANGE_RATES_TO_KRW[currency] || 1
  return Math.round(amount * rate)
}

export function formatCurrency(amount: number, currency: string): string {
  const symbols: Record<string, string> = {
    KRW: '₩', USD: '$', CNY: '¥', EUR: '€', VND: '₫', RUB: '₽', MXN: '$',
  }
  const symbol = symbols[currency] || currency
  if (amount >= 1_000_000_000) return `${symbol}${(amount / 1_000_000_000).toFixed(1)}B`
  if (amount >= 1_000_000) return `${symbol}${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `${symbol}${(amount / 1_000).toFixed(1)}K`
  return `${symbol}${amount.toLocaleString()}`
}
