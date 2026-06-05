import { describe, it, expect } from 'vitest'
import { resolveCompanyFilter } from '@/lib/api/companyFilter'
import type { SessionUser } from '@/types'

const mk = (role: string, companyId = 'co-self'): SessionUser =>
  ({ role, companyId } as SessionUser)

describe('resolveCompanyFilter', () => {
  it('비-SUPER: requested 타법인을 무시하고 자기 법인 강제', () => {
    expect(resolveCompanyFilter(mk('HR_ADMIN'), 'co-other')).toEqual({ companyId: 'co-self' })
  })
  it('비-SUPER: requested 없어도 자기 법인', () => {
    expect(resolveCompanyFilter(mk('MANAGER'), null)).toEqual({ companyId: 'co-self' })
  })
  it('SUPER: requested 지정 시 해당 법인', () => {
    expect(resolveCompanyFilter(mk('SUPER_ADMIN'), 'co-other')).toEqual({ companyId: 'co-other' })
  })
  it('SUPER: requested 없으면 전체({})', () => {
    expect(resolveCompanyFilter(mk('SUPER_ADMIN'), null)).toEqual({})
  })
  it('SUPER: requested 빈문자열도 전체({})', () => {
    expect(resolveCompanyFilter(mk('SUPER_ADMIN'), '')).toEqual({})
  })
})
