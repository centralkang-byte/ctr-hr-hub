/**
 * CTR HR Hub — Settings Audit Helpers (H-3)
 *
 * Generates human-readable change descriptions when settings are created/updated/reverted.
 * Uses flat-field comparison for simple objects and generic messages for nested/array values.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function generateChangeDescription(oldValue: any, newValue: any): string { // eslint-disable-line @typescript-eslint/no-explicit-any -- generic diff utility
  if (!oldValue && !newValue) return '변경 없음'
  if (!oldValue) return '초기 설정값 생성'
  if (!newValue) return '설정값 삭제 (기본값으로 복원)'

  // Both are non-null — compute diff for flat objects
  if (typeof oldValue !== 'object' || typeof newValue !== 'object') {
    return `값 변경: ${String(oldValue)} → ${String(newValue)}`
  }

  const changes: string[] = []
  const allKeys = new Set([...Object.keys(oldValue), ...Object.keys(newValue)])

  for (const field of allKeys) {
    const oldVal = oldValue[field]
    const newVal = newValue[field]

    // Skip if both are objects/arrays — use generic message to avoid deep-diff issues
    if (
      typeof oldVal === 'object' && oldVal !== null &&
      typeof newVal === 'object' && newVal !== null
    ) {
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes.push(`${field} 설정 업데이트`)
      }
      continue
    }

    if (oldVal !== newVal) {
      if (oldVal === undefined) {
        changes.push(`${field}: (신규) → ${newVal}`)
      } else if (newVal === undefined) {
        changes.push(`${field}: ${oldVal} → (삭제)`)
      } else {
        changes.push(`${field}: ${oldVal} → ${newVal}`)
      }
    }
  }

  return changes.length > 0 ? changes.join(', ') : '변경 없음'
}
