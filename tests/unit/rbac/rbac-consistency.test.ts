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

  it('/analytics/gender-pay-gap is restricted to HR_UP', () => {
    const rule = findRouteRule('/analytics/gender-pay-gap')
    expect(rule?.prefix).toBe('/analytics/gender-pay-gap')
    expect(rule?.allowedRoles).toEqual(ROLE_GROUPS.HR_UP)
    expect(rule?.allowedRoles).not.toContain(ROLE.MANAGER)
    expect(rule?.allowedRoles).not.toContain(ROLE.EXECUTIVE)
  })

  it('/api/v1/analytics/gender-pay-gap and export are restricted to HR_UP', () => {
    for (const path of [
      '/api/v1/analytics/gender-pay-gap',
      '/api/v1/analytics/gender-pay-gap/export',
    ]) {
      const rule = findRouteRule(path)
      expect(rule?.prefix).toBe('/api/v1/analytics/gender-pay-gap')
      expect(rule?.allowedRoles).toEqual(ROLE_GROUPS.HR_UP)
    }
  })

  it('succession pages and APIs are restricted to HR_UP', () => {
    for (const path of [
      '/succession',
      '/talent/succession',
      '/api/v1/succession/plans',
    ]) {
      const rule = findRouteRule(path)
      expect(rule?.allowedRoles).toEqual(ROLE_GROUPS.HR_UP)
    }
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

  it('sensitive analytics prefix comes before the broad analytics prefix', () => {
    const pageSpecific = ROUTE_ACL.findIndex(r => r.prefix === '/analytics/gender-pay-gap')
    const pageBroad = ROUTE_ACL.findIndex(r => r.prefix === '/analytics')
    const apiSpecific = ROUTE_ACL.findIndex(r => r.prefix === '/api/v1/analytics/gender-pay-gap')
    const apiBroad = ROUTE_ACL.findIndex(r => r.prefix === '/api/v1/analytics')

    expect(pageSpecific).toBeLessThan(pageBroad)
    expect(apiSpecific).toBeLessThan(apiBroad)
  })

  // recruitment/requisitions: /new(HR_UP) → /requisitions(ALL_ROLES) → /recruitment(HR_UP).
  // 순서가 깨지면 dept_head EMPLOYEE/MANAGER가 catch-all에 가로채여 403 redirect.
  it('more specific prefixes come before general ones (recruitment/requisitions)', () => {
    const newIdx = ROUTE_ACL.findIndex(r => r.prefix === '/recruitment/requisitions/new')
    const requisitionsIdx = ROUTE_ACL.findIndex(r => r.prefix === '/recruitment/requisitions')
    const recruitmentIdx = ROUTE_ACL.findIndex(r => r.prefix === '/recruitment')
    expect(newIdx).toBeGreaterThanOrEqual(0)
    expect(requisitionsIdx).toBeGreaterThanOrEqual(0)
    expect(recruitmentIdx).toBeGreaterThanOrEqual(0)
    expect(newIdx).toBeLessThan(requisitionsIdx)
    expect(requisitionsIdx).toBeLessThan(recruitmentIdx)
  })

  it('/recruitment/requisitions allows ALL_ROLES (dept_head EMPLOYEE/MANAGER 결재자 진입)', () => {
    const rule = findRouteRule('/recruitment/requisitions')
    expect(rule).not.toBeNull()
    expect(rule!.prefix).toBe('/recruitment/requisitions')
    expect(rule!.allowedRoles).toContain(ROLE.EMPLOYEE)
    expect(rule!.allowedRoles).toContain(ROLE.MANAGER)
  })

  it('/recruitment/requisitions/new is restricted to HR_UP (생성은 HR만)', () => {
    const rule = findRouteRule('/recruitment/requisitions/new')
    expect(rule).not.toBeNull()
    expect(rule!.prefix).toBe('/recruitment/requisitions/new')
    expect(rule!.allowedRoles).not.toContain(ROLE.EMPLOYEE)
    expect(rule!.allowedRoles).not.toContain(ROLE.MANAGER)
    expect(rule!.allowedRoles).toContain(ROLE.HR_ADMIN)
    expect(rule!.allowedRoles).toContain(ROLE.SUPER_ADMIN)
  })

  it('/recruitment/postings remains HR_UP (catch-all preserved for non-requisitions)', () => {
    const rule = findRouteRule('/recruitment/postings')
    expect(rule).not.toBeNull()
    expect(rule!.prefix).toBe('/recruitment')
    expect(rule!.allowedRoles).not.toContain(ROLE.EMPLOYEE)
    expect(rule!.allowedRoles).not.toContain(ROLE.MANAGER)
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
