// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Date Utilities
// ═══════════════════════════════════════════════════════════

/**
 * 상대 시간 포맷
 * "방금 전" / "3분 전" / "2시간 전" / "1일 전" / "3일 전" / "2026-02-25"
 */
export function formatRelativeTime(date: Date | string): string {
  const target = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - target.getTime()
  const diffSec = Math.floor(diffMs / 1000)

  if (diffSec < 60) return '방금 전'

  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}분 전`

  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}시간 전`

  const diffDay = Math.floor(diffHour / 24)
  if (diffDay <= 7) return `${diffDay}일 전`

  // 7일 초과: yyyy-MM-dd
  const y = target.getFullYear()
  const m = String(target.getMonth() + 1).padStart(2, '0')
  const d = String(target.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
