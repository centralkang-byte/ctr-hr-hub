import { describe, it, expect } from 'vitest'
import { resolveCompanyId } from '@/lib/api/companyFilter'
import type { SessionUser } from '@/types'

// ─── Helpers ────────────────────────────────────────────────

function mockUser(role: string, companyId = 'company-default'): SessionUser {
  return {
    id: 'user-1',
    employeeId: 'emp-1',
    role,
    companyId,
    name: 'Test User',
    email: 'test@ctr.co.kr',
  } as SessionUser
}

// ─── Tests ──────────────────────────────────────────────────

describe('resolveCompanyId', () => {
  it('should allow SUPER_ADMIN to use requested companyId', () => {
    const user = mockUser('SUPER_ADMIN', 'default-co')
    expect(resolveCompanyId(user, 'other-co')).toBe('other-co')
  })

  it('should fallback to user.companyId when SUPER_ADMIN passes null', () => {
    const user = mockUser('SUPER_ADMIN', 'default-co')
    expect(resolveCompanyId(user, null)).toBe('default-co')
  })

  it('should fallback to user.companyId when SUPER_ADMIN passes undefined', () => {
    const user = mockUser('SUPER_ADMIN', 'default-co')
    expect(resolveCompanyId(user, undefined)).toBe('default-co')
  })

  it('should ignore requested companyId for HR_ADMIN', () => {
    const user = mockUser('HR_ADMIN', 'default-co')
    expect(resolveCompanyId(user, 'other-co')).toBe('default-co')
  })

  it('should ignore requested companyId for MANAGER', () => {
    const user = mockUser('MANAGER', 'default-co')
    expect(resolveCompanyId(user, 'other-co')).toBe('default-co')
  })

  it('should ignore requested companyId for EMPLOYEE', () => {
    const user = mockUser('EMPLOYEE', 'default-co')
    expect(resolveCompanyId(user, 'other-co')).toBe('default-co')
  })

  it('should treat empty string as falsy for SUPER_ADMIN', () => {
    const user = mockUser('SUPER_ADMIN', 'default-co')
    expect(resolveCompanyId(user, '')).toBe('default-co')
  })
})
