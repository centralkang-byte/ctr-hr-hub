import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    employeeRole: {
      findMany: vi.fn(),
    },
    employee: {
      findFirst: vi.fn(),
    },
  },
}))

import {
  getActiveRoleCodes,
  buildEffectiveRoleCodes,
  getEligibleApproverRolesForRequisition,
  findActiveRoleHolderId,
} from '@/lib/employee/active-roles'
import { prisma } from '@/lib/prisma'

const mockedFindMany = vi.mocked(prisma.employeeRole.findMany)
const mockedEmployeeFindFirst = vi.mocked(prisma.employee.findFirst)

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

// Session 207 — resolve-approval-flow.ts:143 hr_admin/ceo routing 정합화 helper.
describe('findActiveRoleHolderId', () => {
  beforeEach(() => {
    mockedEmployeeFindFirst.mockReset()
  })

  it('returns null when no employee matches in ACTIVE (and falls through to ON_LEAVE which is also empty)', async () => {
    mockedEmployeeFindFirst
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce(null as never)

    const result = await findActiveRoleHolderId(['HR_ADMIN'], 'company-A')

    expect(result).toBeNull()
  })

  it('returns first matching employee for single role code', async () => {
    mockedEmployeeFindFirst.mockResolvedValueOnce({ id: 'emp-hr-1' } as never)

    const result = await findActiveRoleHolderId(['HR_ADMIN'], 'company-A')

    expect(result).toBe('emp-hr-1')
  })

  it('returns first matching for multi-role disjunction (SUPER_ADMIN | EXECUTIVE)', async () => {
    mockedEmployeeFindFirst.mockResolvedValueOnce({ id: 'emp-ceo' } as never)

    const result = await findActiveRoleHolderId(
      ['SUPER_ADMIN', 'EXECUTIVE'],
      'company-A',
    )

    expect(result).toBe('emp-ceo')
  })

  it('queries by Role.code (not Role.name) — Session 207 SSOT fix', async () => {
    // 기존 Role.name 매칭 버그(seed name='HR Admin' vs code='HR_ADMIN' 불일치) fix.
    // 쿼리가 role.code 사용하는지 invariant 검증.
    mockedEmployeeFindFirst.mockResolvedValueOnce({ id: 'emp-1' } as never)

    await findActiveRoleHolderId(['HR_ADMIN'], 'company-A')

    const where = mockedEmployeeFindFirst.mock.calls[0]?.[0]?.where as {
      employeeRoles?: { some?: { role?: { code?: { in?: string[] } } } }
    }
    expect(where?.employeeRoles?.some?.role?.code?.in).toEqual(['HR_ADMIN'])
  })

  it('enforces EmployeeRole.endDate=null + companyId scope', async () => {
    // 기존 누락 fix: 만료된 EmployeeRole row + 다른 법인 EmployeeRole row 자연 제외.
    mockedEmployeeFindFirst.mockResolvedValueOnce({ id: 'emp-1' } as never)

    await findActiveRoleHolderId(['HR_ADMIN'], 'company-A')

    const where = mockedEmployeeFindFirst.mock.calls[0]?.[0]?.where as {
      employeeRoles?: { some?: Record<string, unknown> }
    }
    expect(where?.employeeRoles?.some).toMatchObject({
      companyId: 'company-A',
      endDate: null,
    })
  })

  it('prefers ACTIVE over ON_LEAVE (Codex Gate 2 R1 P2)', async () => {
    // 1차 쿼리(ACTIVE)에서 직원 발견 → 2차 쿼리(ON_LEAVE) 호출 안 함.
    mockedEmployeeFindFirst.mockResolvedValueOnce({ id: 'emp-active' } as never)

    const result = await findActiveRoleHolderId(['HR_ADMIN'], 'company-A')

    expect(result).toBe('emp-active')
    expect(mockedEmployeeFindFirst).toHaveBeenCalledTimes(1)
    // 1st call queries ACTIVE-only.
    const firstWhere = mockedEmployeeFindFirst.mock.calls[0]?.[0]?.where as {
      assignments?: { some?: { status?: string } }
    }
    expect(firstWhere?.assignments?.some?.status).toBe('ACTIVE')
  })

  it('falls back to ON_LEAVE when no ACTIVE holder exists', async () => {
    // 1차 쿼리(ACTIVE) null → 2차 쿼리(ON_LEAVE) 호출 → 휴직 중 직원 routing.
    // 법인 전체 ACTIVE HR/CEO 부재 시 결재 stuck 차단 (Session 206 validator 정합).
    mockedEmployeeFindFirst
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce({ id: 'emp-on-leave' } as never)

    const result = await findActiveRoleHolderId(['HR_ADMIN'], 'company-A')

    expect(result).toBe('emp-on-leave')
    expect(mockedEmployeeFindFirst).toHaveBeenCalledTimes(2)
    // 2nd call queries ON_LEAVE-only.
    const secondWhere = mockedEmployeeFindFirst.mock.calls[1]?.[0]?.where as {
      assignments?: { some?: { status?: string } }
    }
    expect(secondWhere?.assignments?.some?.status).toBe('ON_LEAVE')
  })

  it('applies deterministic orderBy createdAt asc on both ACTIVE and ON_LEAVE queries', async () => {
    // 다수의 HR admin/CEO 보유 법인에서 결정성 보장 (가장 오래된 직원 = 대표).
    mockedEmployeeFindFirst
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce({ id: 'emp-1' } as never)

    await findActiveRoleHolderId(['HR_ADMIN'], 'company-A')

    expect(mockedEmployeeFindFirst.mock.calls[0]?.[0]?.orderBy).toEqual({
      createdAt: 'asc',
    })
    expect(mockedEmployeeFindFirst.mock.calls[1]?.[0]?.orderBy).toEqual({
      createdAt: 'asc',
    })
  })

  it('returns null when no holder in either ACTIVE or ON_LEAVE', async () => {
    mockedEmployeeFindFirst
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce(null as never)

    const result = await findActiveRoleHolderId(['HR_ADMIN'], 'company-A')

    expect(result).toBeNull()
    expect(mockedEmployeeFindFirst).toHaveBeenCalledTimes(2)
  })
})
