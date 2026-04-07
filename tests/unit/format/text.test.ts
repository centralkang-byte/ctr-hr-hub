import { describe, it, expect } from 'vitest'
import { truncateText, getInitials, getAvatarColor } from '@/lib/format/text'

// ─── truncateText ──────────────────────────────────────────

describe('truncateText', () => {
  it('should return empty string for null', () => {
    expect(truncateText(null)).toBe('')
  })

  it('should return empty string for empty input', () => {
    expect(truncateText('')).toBe('')
  })

  it('should return unchanged text when under maxLength', () => {
    expect(truncateText('Hello World')).toBe('Hello World')
  })

  it('should truncate at 50 chars with ellipsis by default', () => {
    const long = 'A'.repeat(60)
    const result = truncateText(long)
    expect(result).toBe('A'.repeat(50) + '\u2026')
    expect(result.length).toBe(51) // 50 chars + ellipsis
  })
})

// ─── getInitials ───────────────────────────────────────────

describe('getInitials', () => {
  it('should return ? for null', () => {
    expect(getInitials(null)).toBe('?')
  })

  it('should return first char for single name', () => {
    expect(getInitials('Admin')).toBe('A')
  })

  it('should return first+last initials for two names', () => {
    expect(getInitials('Kim Sangwoo')).toBe('KS')
  })
})

// ─── getAvatarColor ────────────────────────────────────────

describe('getAvatarColor', () => {
  it('should return gray default for null', () => {
    expect(getAvatarColor(null)).toBe('#6B7280')
  })

  it('should return one of the 8 predefined colors', () => {
    const colors = ['#5E81F4', '#8B5CF6', '#F59E0B', '#10B981', '#EF4444', '#EC4899', '#06B6D4', '#84CC16']
    expect(colors).toContain(getAvatarColor('Test User'))
  })

  it('should return the same color for the same name (deterministic)', () => {
    expect(getAvatarColor('Alice')).toBe(getAvatarColor('Alice'))
  })
})
