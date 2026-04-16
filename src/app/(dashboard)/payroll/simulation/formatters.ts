// ─── Shared Simulation Formatters ──────────────────────────
// Locale-parameterized pure functions (no hooks)

export const fmtN = (n: number, locale: string) => n.toLocaleString(locale)

export const fmtKRW = (n: number, locale: string) =>
  `₩${Math.abs(n).toLocaleString(locale)}`

export const signedKRW = (n: number, locale: string) =>
  n === 0 ? '₩0' : `${n > 0 ? '+' : '-'}${fmtKRW(n, locale)}`

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
