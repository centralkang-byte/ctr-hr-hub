import { describe, it, expect, vi } from 'vitest'
import { extractPrimaryAssignment } from '@/lib/employee/extract-primary-assignment'

// ─── Helpers ───────────────────────────────────────────────

function makeAssignment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'a-1',
    isPrimary: true,
    endDate: null,
    effectiveDate: '2020-01-01',
    ...overrides,
  }
}

// ─── extractPrimaryAssignment ──────────────────────────────

describe('extractPrimaryAssignment', () => {
  it('should return undefined for empty array', () => {
    expect(extractPrimaryAssignment([])).toBeUndefined()
  })

  it('should return the single item (fast path)', () => {
    const single = makeAssignment({ id: 'only' })
    expect(extractPrimaryAssignment([single])).toBe(single)
  })

  it('should prefer active primary over ended primary', () => {
    const ended = makeAssignment({ id: 'ended', endDate: '2024-12-31' })
    const active = makeAssignment({ id: 'active', endDate: null, effectiveDate: '2020-06-01' })
    expect(extractPrimaryAssignment([ended, active])?.id).toBe('active')
  })

  it('should fallback to ended primary when no active primary exists', () => {
    const endedPrimary = makeAssignment({ id: 'ended-primary', endDate: '2024-12-31' })
    const nonPrimary = makeAssignment({ id: 'non-primary', isPrimary: false, endDate: null })
    expect(extractPrimaryAssignment([nonPrimary, endedPrimary])?.id).toBe('ended-primary')
  })

  it('should fallback to most recent effectiveDate when no isPrimary exists', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const old = { id: 'old', effectiveDate: '2020-01-01' }
    const recent = { id: 'recent', effectiveDate: '2024-06-01' }
    expect(extractPrimaryAssignment([old, recent])?.id).toBe('recent')
    expect(warnSpy).toHaveBeenCalledOnce()
    warnSpy.mockRestore()
  })
})
