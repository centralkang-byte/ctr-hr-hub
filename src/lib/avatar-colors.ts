// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Avatar Color Utility
// Deterministic avatar colors based on department ID
// ═══════════════════════════════════════════════════════════

/**
 * 9 curated colors cycling based on departmentId hash.
 * Same department always gets the same color.
 */
const AVATAR_COLORS = [
  '#7F77DD', // Purple
  '#1D9E75', // Teal
  '#378ADD', // Blue
  '#D85A30', // Coral
  '#BA7517', // Amber
  '#639922', // Green
  '#D4537E', // Pink
  '#888780', // Gray
  '#E24B4A', // Red
] as const

const GHOST_COLOR = '#B4B2A9'

/**
 * Get deterministic avatar background color from departmentId.
 * Same departmentId always returns the same color.
 */
export function getAvatarColor(departmentId?: string | null): string {
  if (!departmentId) return GHOST_COLOR
  let hash = 0
  for (let i = 0; i < departmentId.length; i++) {
    hash = ((hash << 5) - hash + departmentId.charCodeAt(i)) | 0
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

/**
 * Get initials from name.
 * Korean/Chinese: First 2 characters (e.g., 김인 → 김인)
 * Latin: First letter of first + last name (e.g., John Smith → JS)
 */
export function getInitials(name?: string | null, nameEn?: string | null): string {
  if (!name && !nameEn) return '?'

  // Try English name first for initials (more universal in mixed contexts)
  if (nameEn) {
    const parts = nameEn.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return nameEn.slice(0, 2).toUpperCase()
  }

  // Korean/Chinese: take first 2 chars of name
  if (name) {
    const isKoreanOrChinese = /[\u3131-\uD79D\u4E00-\u9FFF]/.test(name)
    if (isKoreanOrChinese) {
      return name.slice(0, 2)
    }
    // Latin fallback
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }

  return '?'
}
