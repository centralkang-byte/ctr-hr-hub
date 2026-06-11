// ─── Shared Simulation Formatters ──────────────────────────
// Locale-parameterized pure functions (no hooks)

export const fmtN = (n: number, locale: string) => n.toLocaleString(locale)

export const fmtKRW = (n: number, locale: string) =>
  `₩${Math.abs(n).toLocaleString(locale)}`

export const signedKRW = (n: number, locale: string) =>
  n === 0 ? '₩0' : `${n > 0 ? '+' : '-'}${fmtKRW(n, locale)}`

/** Compact KRW (SIM-10/X-4): ko = '만' 단위, 그 외 locale = Intl compact 표기
 *  — 하드코딩 '만'이 비한국어 locale에 누출되지 않도록 locale 분기 */
export const fmtCompactKRW = (won: number, locale: string) =>
  locale === 'ko'
    ? `₩${Math.round(won / 10000).toLocaleString(locale)}만`
    : `₩${new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(won)}`

export const pctStr = (r: number) =>
  `${r >= 0 ? '+' : ''}${(r * 100).toFixed(1)}%`

export const pctChange = (cur: number, adj: number) => {
  if (cur === 0) return '0.0%'
  const pct = ((adj - cur) / cur) * 100
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`
}

export function diffColor(n: number) {
  if (n > 0) return 'text-primary'
  if (n < 0) return 'text-destructive'
  return 'text-muted-foreground'
}

export function diffArrow(n: number) {
  if (n > 0) return '▲'
  if (n < 0) return '▼'
  return ''
}
