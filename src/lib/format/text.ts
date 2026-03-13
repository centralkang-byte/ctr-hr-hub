/**
 * Text utilities — Art.14 (truncation), Art.13 (avatar)
 */

/** Truncate text with ellipsis */
export function truncateText(text: string | null | undefined, maxLength: number = 50): string {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '…'
}

/** Generate initials from name — Art.13 */
export function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

/** Generate consistent color from name hash — Art.13 */
export function getAvatarColor(name: string | null | undefined): string {
  if (!name) return '#6B7280'
  const colors = [
    '#4F46E5', '#8B5CF6', '#F59E0B', '#10B981',
    '#EF4444', '#EC4899', '#06B6D4', '#84CC16',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}
