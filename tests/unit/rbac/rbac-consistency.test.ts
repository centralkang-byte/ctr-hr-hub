import { describe, it, expect } from 'vitest'
import { ROLE_GROUPS, ROUTE_ACL, findRouteRule } from '@/lib/rbac/rbac-spec'
import { ROLE } from '@/lib/constants'

// ─── RBAC SSOT Consistency Tests ────────────────────────────

describe('RBAC SSOT (rbac-spec.ts)', () => {
  // ── Role Group Integrity ──────────────────────────────────

  it('ALL_ROLES contains all 5 defined roles', () => {
    const expected = Object.values(ROLE)
    expect(ROLE_GROUPS.ALL_ROLES).toHaveLength(expected.length)
    for (const role of expected) {
      expect(ROLE_GROUPS.ALL_ROLES).toContain(role)
    }
  })

  it('MANAGER_UP is a subset of ALL_ROLES', () => {
    for (const role of ROLE_GROUPS.MANAGER_UP) {
      expect(ROLE_GROUPS.ALL_ROLES).toContain(role)
    }
  })

  it('MANAGER_ONLY is a subset of ALL_ROLES', () => {
    for (const role of ROLE_GROUPS.MANAGER_ONLY) {
      expect(ROLE_GROUPS.ALL_ROLES).toContain(role)
    }
  })

  it('HR_UP is a subset of ALL_ROLES', () => {
    for (const role of ROLE_GROUPS.HR_UP) {
      expect(ROLE_GROUPS.ALL_ROLES).toContain(role)
    }
  })

  it('MANAGER_ONLY excludes EXECUTIVE', () => {
    expect(ROLE_GROUPS.MANAGER_ONLY).not.toContain(ROLE.EXECUTIVE)
  })

  it('MANAGER_UP includes EXECUTIVE', () => {
    expect(ROLE_GROUPS.MANAGER_UP).toContain(ROLE.EXECUTIVE)
  })

  it('HR_UP does not include EMPLOYEE or MANAGER', () => {
    expect(ROLE_GROUPS.HR_UP).not.toContain(ROLE.EMPLOYEE)
    expect(ROLE_GROUPS.HR_UP).not.toContain(ROLE.MANAGER)
  })

  // ── Route ACL Consistency ─────────────────────────────────

  it('every route rule uses only valid roles', () => {
    const validRoles = new Set(ROLE_GROUPS.ALL_ROLES)
    for (const rule of ROUTE_ACL) {
      for (const role of rule.allowedRoles) {
        expect(validRoles.has(role as typeof ROLE_GROUPS.ALL_ROLES[number])).toBe(true)
      }
    }
  })

  it('/manager-hub page uses MANAGER_ONLY (excludes EXECUTIVE)', () => {
    const rule = findRouteRule('/manager-hub')
    expect(rule).not.toBeNull()
    expect(rule!.allowedRoles).not.toContain(ROLE.EXECUTIVE)
    expect(rule!.allowedRoles).toContain(ROLE.MANAGER)
    expect(rule!.allowedRoles).toContain(ROLE.HR_ADMIN)
    expect(rule!.allowedRoles).toContain(ROLE.SUPER_ADMIN)
  })

  it('/api/v1/manager-hub API uses MANAGER_ONLY (excludes EXECUTIVE)', () => {
    const rule = findRouteRule('/api/v1/manager-hub/summary')
    expect(rule).not.toBeNull()
    expect(rule!.allowedRoles).not.toContain(ROLE.EXECUTIVE)
  })

  it('/analytics allows EXECUTIVE (strategic insights)', () => {
    const rule = findRouteRule('/analytics')
    expect(rule).not.toBeNull()
    expect(rule!.allowedRoles).toContain(ROLE.EXECUTIVE)
  })

  it('/settings is restricted to HR_UP', () => {
    const rule = findRouteRule('/settings')
    expect(rule).not.toBeNull()
    expect(rule!.allowedRoles).toEqual(expect.arrayContaining([...ROLE_GROUPS.HR_UP]))
    expect(rule!.allowedRoles).not.toContain(ROLE.EMPLOYEE)
    expect(rule!.allowedRoles).not.toContain(ROLE.MANAGER)
  })

  it('/payroll/me is accessible to ALL_ROLES', () => {
    const rule = findRouteRule('/payroll/me')
    expect(rule).not.toBeNull()
    expect(rule!.allowedRoles).toHaveLength(ROLE_GROUPS.ALL_ROLES.length)
  })

  it('/payroll (admin) is restricted to HR_UP', () => {
    const rule = findRouteRule('/payroll')
    expect(rule).not.toBeNull()
    expect(rule!.allowedRoles).not.toContain(ROLE.EMPLOYEE)
    expect(rule!.allowedRoles).not.toContain(ROLE.MANAGER)
  })

  // ── Route Prefix Order ────────────────────────────────────

  it('more specific prefixes come before general ones (payroll/me before payroll)', () => {
    const payrollMeIdx = ROUTE_ACL.findIndex(r => r.prefix === '/payroll/me')
    const payrollIdx = ROUTE_ACL.findIndex(r => r.prefix === '/payroll')
    expect(payrollMeIdx).toBeLessThan(payrollIdx)
  })

  it('more specific prefixes come before general ones (onboarding/me before onboarding)', () => {
    const onboardingMeIdx = ROUTE_ACL.findIndex(r => r.prefix === '/onboarding/me')
    const onboardingIdx = ROUTE_ACL.findIndex(r => r.prefix === '/onboarding')
    expect(onboardingMeIdx).toBeLessThan(onboardingIdx)
  })

  // ── findRouteRule ─────────────────────────────────────────

  it('returns null for unlisted routes (any authenticated role allowed)', () => {
    expect(findRouteRule('/home')).toBeNull()
    expect(findRouteRule('/my/leave')).toBeNull()
  })

  it('matches exact prefix', () => {
    expect(findRouteRule('/settings')).not.toBeNull()
  })

  it('matches path under prefix', () => {
    expect(findRouteRule('/settings/organization')).not.toBeNull()
    expect(findRouteRule('/settings/organization')!.prefix).toBe('/settings')
  })
})
