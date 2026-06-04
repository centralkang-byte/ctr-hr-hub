import { describe, it, expect } from 'vitest'
import { isPayrollApprovalPath, ROLE_GROUPS } from '@/lib/rbac/rbac-spec'

describe('isPayrollApprovalPath', () => {
  it('matches the approval page + approve/reject/approval-status APIs', () => {
    expect(isPayrollApprovalPath('/payroll/abc-123/approve')).toBe(true)
    expect(isPayrollApprovalPath('/api/v1/payroll/abc-123/approve')).toBe(true)
    expect(isPayrollApprovalPath('/api/v1/payroll/abc-123/reject')).toBe(true)
    expect(isPayrollApprovalPath('/api/v1/payroll/abc-123/approval-status')).toBe(true)
  })
  it('tolerates a single trailing slash (Codex G2 P2 — fail-closed robustness)', () => {
    expect(isPayrollApprovalPath('/payroll/abc-123/approve/')).toBe(true)
    expect(isPayrollApprovalPath('/api/v1/payroll/abc-123/approve/')).toBe(true)
    expect(isPayrollApprovalPath('/api/v1/payroll/abc-123/reject/')).toBe(true)
  })
  it('does NOT match payroll-admin routes or self-service', () => {
    expect(isPayrollApprovalPath('/payroll')).toBe(false)
    expect(isPayrollApprovalPath('/payroll/me')).toBe(false)
    expect(isPayrollApprovalPath('/payroll/abc-123/review')).toBe(false)
    expect(isPayrollApprovalPath('/payroll/abc-123/publish')).toBe(false)
    expect(isPayrollApprovalPath('/api/v1/payroll/calculate')).toBe(false)
    // dead route (deleted in this PR) — never carved out:
    expect(isPayrollApprovalPath('/api/v1/payroll/runs/abc-123/approve')).toBe(false)
    // anchored — no trailing segment allowed:
    expect(isPayrollApprovalPath('/api/v1/payroll/abc-123/approve/extra')).toBe(false)
  })
})

describe('PAYROLL_APPROVERS group', () => {
  it('includes HR_ADMIN, EXECUTIVE, SUPER_ADMIN and excludes MANAGER/EMPLOYEE', () => {
    expect([...ROLE_GROUPS.PAYROLL_APPROVERS].sort()).toEqual(['EXECUTIVE', 'HR_ADMIN', 'SUPER_ADMIN'])
    expect(ROLE_GROUPS.PAYROLL_APPROVERS).not.toContain('MANAGER')
    expect(ROLE_GROUPS.PAYROLL_APPROVERS).not.toContain('EMPLOYEE')
  })
})
