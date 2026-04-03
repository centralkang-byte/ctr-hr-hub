/**
 * Date formatting utilities — Art.11
 * Table: "2026.03.12" | Detail: "2026년 3월 12일"
 */

/** Date → "2026.03.12" (table/list) */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '-'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '-'
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}.${m}.${day}`
}

/** Date → "2026.03.12 14:30" (table with time) */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '-'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '-'
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${formatDate(date)} ${h}:${min}`
}

/** Date → "2026년 3월 12일" (detail/heading) */
export function formatDateLong(date: Date | string | null | undefined): string {
  if (!date) return '-'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '-'
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

/** Date → "3월 12일" (compact) */
export function formatDateShort(date: Date | string | null | undefined): string {
  if (!date) return '-'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '-'
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

/** Date → "2026-03" (month key) */
export function formatMonth(date: Date | string | null | undefined): string {
  if (!date) return '-'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '-'
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Date → "2026-03-12" (ISO date, internal/API key) */
export function formatDateISO(date: Date | string | null | undefined): string {
  if (!date) return '-'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '-'
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Date → "2026. 3. 12." (Korean locale default) */
export function formatDateLocale(date: Date | string | null | undefined): string {
  if (!date) return '-'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('ko-KR')
}

const DAY_NAMES_KO = ['일', '월', '화', '수', '목', '금', '토'] as const

/** Date → "3월 12일 (수)" (short with day-of-week) */
export function formatDateWithDay(date: Date | string | null | undefined): string {
  if (!date) return '-'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '-'
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DAY_NAMES_KO[d.getDay()]})`
}

/** Date → "3/12 (수)" (compact with day-of-week) */
export function formatDateCompactWithDay(date: Date | string | null | undefined): string {
  if (!date) return '-'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '-'
  return `${d.getMonth() + 1}/${d.getDate()} (${DAY_NAMES_KO[d.getDay()]})`
}
