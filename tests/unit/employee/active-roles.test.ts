import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    employeeRole: {
      findMany: vi.fn(),
    },
  },
}))

import {
  getActiveRoleCodes,
  buildEffectiveRoleCodes,
  getEligibleApproverRolesForRequisition,
} from '@/lib/employee/active-roles'
import { prisma } from '@/lib/prisma'

const mockedFindMany = vi.mocked(prisma.employeeRole.findMany)

describe('getActiveRoleCodes', () => {
  beforeEach(() => {
    mockedFindMany.mockReset()
  })

  it('returns empty Set when employee has no active roles', async () => {
    mockedFindMany.mockResolvedValueOnce([] as never)

    const result = await getActiveRoleCodes('emp-1', 'company-A')

    expect(result).toEqual(new Set())
    expect(mockedFindMany).toHaveBeenCalledWith({
      where: { employeeId: 'emp-1', companyId: 'company-A', endDate: null },
      select: { role: { select: { code: true } } },
    })
  })

  it('returns single role code', async () => {
    mockedFindMany.mockResolvedValueOnce([
      { role: { code: 'EMPLOYEE' } },
    ] as never)

    const result = await getActiveRoleCodes('emp-1', 'company-A')

    expect(result).toEqual(new Set(['EMPLOYEE']))
  })

  it('returns multiple role codes (multi-role employee)', async () => {
    // 멀티롤 시나리오: MANAGER + HR_ADMIN 동시 보유.
    mockedFindMany.mockResolvedValueOnce([
      { role: { code: 'MANAGER' } },
      { role: { code: 'HR_ADMIN' } },
    ] as never)

    const result = await getActiveRoleCodes('emp-1', 'company-A')

    expect(result).toEqual(new Set(['MANAGER', 'HR_ADMIN']))
  })

  it('enforces companyId scope (cross-tenant guard)', async () => {
    mockedFindMany.mockResolvedValueOnce([
      { role: { code: 'EMPLOYEE' } },
    ] as never)

    await getActiveRoleCodes('emp-1', 'company-B')

    // 쿼리에 companyId 명시 — 다른 법인의 role row가 결과에 섞이지 않음.
    expect(mockedFindMany.mock.calls[0]?.[0]?.where).toMatchObject({
      employeeId: 'emp-1',
      companyId: 'company-B',
      endDate: null,
    })
  })

  it('relies on Prisma to exclude expired roles via endDate=null filter', async () => {
    // expired role(endDate set)이 결과에 섞이지 않는지 invariant. Prisma 필터가
    // endDate=null만 매칭하므로 만료된 role row는 자연 제외.
    mockedFindMany.mockResolvedValueOnce([
      { role: { code: 'HR_ADMIN' } }, // active
    ] as never)

    const result = await getActiveRoleCodes('emp-1', 'company-A')

    expect(result).toEqual(new Set(['HR_ADMIN']))
    expect(mockedFindMany.mock.calls[0]?.[0]?.where).toMatchObject({
      endDate: null,
    })
  })
})

describe('buildEffectiveRoleCodes', () => {
  it('unions session role into active role set', () => {
    const active = new Set(['HR_ADMIN'])
    const result = buildEffectiveRoleCodes(active, 'MANAGER')

    expect(result).toEqual(new Set(['HR_ADMIN', 'MANAGER']))
  })

  it('handles overlap (session role already in active set)', () => {
    const active = new Set(['HR_ADMIN', 'MANAGER'])
    const result = buildEffectiveRoleCodes(active, 'MANAGER')

    expect(result).toEqual(new Set(['HR_ADMIN', 'MANAGER']))
  })

  it('does not mutate input set', () => {
    const active = new Set(['HR_ADMIN'])
    const result = buildEffectiveRoleCodes(active, 'MANAGER')

    expect(active).toEqual(new Set(['HR_ADMIN']))
    expect(result).not.toBe(active)
  })

  it('falls back to session role only when active set empty', () => {
    const result = buildEffectiveRoleCodes(new Set(), 'EMPLOYEE')

    expect(result).toEqual(new Set(['EMPLOYEE']))
  })
})

describe('getEligibleApproverRolesForRequisition', () => {
  it('returns empty for plain EMPLOYEE', () => {
    expect(getEligibleApproverRolesForRequisition(new Set(['EMPLOYEE']))).toEqual([])
  })

  it('returns hr_admin for HR_ADMIN', () => {
    expect(getEligibleApproverRolesForRequisition(new Set(['HR_ADMIN']))).toEqual([
      'hr_admin',
    ])
  })

  it('returns ceo for EXECUTIVE', () => {
    expect(getEligibleApproverRolesForRequisition(new Set(['EXECUTIVE']))).toEqual([
      'ceo',
    ])
  })

  it('returns hr_admin and ceo for SUPER_ADMIN (super-set bypass)', () => {
    const result = getEligibleApproverRolesForRequisition(new Set(['SUPER_ADMIN']))

    expect(result).toEqual(['hr_admin', 'ceo'])
  })

  it('returns combined list for multi-role employee (HR_ADMIN + EXECUTIVE)', () => {
    const result = getEligibleApproverRolesForRequisition(
      new Set(['HR_ADMIN', 'EXECUTIVE']),
    )

    expect(result).toEqual(['hr_admin', 'ceo'])
  })

  it('returns combined for MANAGER + HR_ADMIN (Session 207 multi-role gap fix)', () => {
    // 핵심 시나리오: SessionUser.role='MANAGER'로 pin됐어도 EmployeeRole에 HR_ADMIN
    // 보유 시 hr_admin step 결재 가능. 본 매퍼가 list/validator 양쪽에서 동일 결정 보장.
    const result = getEligibleApproverRolesForRequisition(
      new Set(['MANAGER', 'HR_ADMIN']),
    )

    expect(result).toEqual(['hr_admin'])
  })

  it('does not return ceo/hr_admin for unrelated roles', () => {
    expect(
      getEligibleApproverRolesForRequisition(new Set(['MANAGER', 'EMPLOYEE'])),
    ).toEqual([])
  })
})
