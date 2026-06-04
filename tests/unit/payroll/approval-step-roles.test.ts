import { describe, it, expect } from 'vitest'
import { resolvePayrollStepRoleCodes } from '@/lib/payroll/approval-step-roles'

describe('resolvePayrollStepRoleCodes', () => {
  it('maps ceo → SUPER_ADMIN + EXECUTIVE', () => {
    expect(resolvePayrollStepRoleCodes('ceo')).toEqual(['SUPER_ADMIN', 'EXECUTIVE'])
  })
  it('maps hr_admin → HR_ADMIN', () => {
    expect(resolvePayrollStepRoleCodes('hr_admin')).toEqual(['HR_ADMIN'])
  })
  it('falls back to the literal code for custom/unknown roles', () => {
    expect(resolvePayrollStepRoleCodes('finance')).toEqual(['finance'])
    expect(resolvePayrollStepRoleCodes('SOME_CUSTOM')).toEqual(['SOME_CUSTOM'])
  })
})
