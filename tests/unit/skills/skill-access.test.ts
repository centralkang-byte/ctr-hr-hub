// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Skills 접근 게이트 SSOT 단위 테스트
// src/lib/skills/skill-access.ts
//
// 검증: 읽기(canReadEmployeeSkills) = 본인·SUPER(전사)·HR/EXEC/MANAGER(자사),
//       쓰기(canWriteEmployeeSkills) = SUPER(전사)·HR(자사)·MANAGER(직속부하),
//       자사 판정은 isTargetInCompany(활성 primary 발령), MANAGER 쓰기는
//       isCurrentManagerOf(보고라인). cross-tenant·수평권한 fail-closed 회귀 차단.
// ═══════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    employee: { findFirst: vi.fn() },
  },
}))

vi.mock('@/lib/performance/peer-access', () => ({
  isCurrentManagerOf: vi.fn(),
}))

import {
  canReadEmployeeSkills,
  canWriteEmployeeSkills,
  isTargetInCompany,
} from '@/lib/skills/skill-access'
import { prisma } from '@/lib/prisma'
import { isCurrentManagerOf } from '@/lib/performance/peer-access'

const mockedFindFirst = vi.mocked(prisma.employee.findFirst)
const mockedIsManager = vi.mocked(isCurrentManagerOf)

const SELF = 'emp-self'
const TARGET = 'emp-target'
const CO = 'company-A'

function user(role: string, opts: { employeeId?: string | null; companyId?: string } = {}) {
  return { employeeId: opts.employeeId ?? SELF, role, companyId: opts.companyId ?? CO }
}

// findFirst 가 회사 매칭 행(또는 null)을 반환하도록 설정
function targetInCompany(inCompany: boolean) {
  mockedFindFirst.mockResolvedValue(inCompany ? ({ id: TARGET } as never) : (null as never))
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('isTargetInCompany', () => {
  it('활성 primary 발령이 회사에 있으면 true', async () => {
    targetInCompany(true)
    expect(await isTargetInCompany(TARGET, CO)).toBe(true)
  })
  it('일치 행이 없으면 false (fail-closed)', async () => {
    targetInCompany(false)
    expect(await isTargetInCompany(TARGET, CO)).toBe(false)
  })
  it('판정은 activeNow 창 사용 — endDate:null 단독 아님 (예약발령 조기포함/현발령 누락 방지)', async () => {
    targetInCompany(true)
    await isTargetInCompany(TARGET, CO)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const some = (mockedFindFirst.mock.calls[0]?.[0] as any)?.where?.assignments?.some
    expect(some.isPrimary).toBe(true)
    expect(some.companyId).toBe(CO)
    expect(some.effectiveDate).toEqual({ lte: expect.any(Date) })
    expect(some.OR).toEqual([{ endDate: null }, { endDate: { gt: expect.any(Date) } }])
  })
})

describe('canReadEmployeeSkills', () => {
  it('본인 조회는 항상 허용 (DB 조회 없이)', async () => {
    expect(await canReadEmployeeSkills(user('EMPLOYEE', { employeeId: TARGET }), TARGET)).toBe(true)
    expect(mockedFindFirst).not.toHaveBeenCalled()
  })

  it('SUPER_ADMIN 은 타사 직원도 허용 (전사, DB 조회 없이)', async () => {
    expect(await canReadEmployeeSkills(user('SUPER_ADMIN'), TARGET)).toBe(true)
    expect(mockedFindFirst).not.toHaveBeenCalled()
  })

  it.each(['HR_ADMIN', 'EXECUTIVE', 'MANAGER'])('%s 는 자사 직원만 허용', async (role) => {
    targetInCompany(true)
    expect(await canReadEmployeeSkills(user(role), TARGET)).toBe(true)
  })

  it.each(['HR_ADMIN', 'EXECUTIVE', 'MANAGER'])('%s 는 타사 직원 차단 (cross-tenant)', async (role) => {
    targetInCompany(false)
    expect(await canReadEmployeeSkills(user(role), TARGET)).toBe(false)
  })

  it('EMPLOYEE 는 타인 조회 불가 (DB 조회 없이)', async () => {
    expect(await canReadEmployeeSkills(user('EMPLOYEE'), TARGET)).toBe(false)
    expect(mockedFindFirst).not.toHaveBeenCalled()
  })
})

describe('canWriteEmployeeSkills', () => {
  it('자기 자신 매니저평가 금지 (SUPER 포함)', async () => {
    expect(await canWriteEmployeeSkills(user('SUPER_ADMIN', { employeeId: TARGET }), TARGET)).toBe(false)
    expect(await canWriteEmployeeSkills(user('MANAGER', { employeeId: TARGET }), TARGET)).toBe(false)
  })

  it('SUPER_ADMIN 은 타사 직원도 평가 허용', async () => {
    expect(await canWriteEmployeeSkills(user('SUPER_ADMIN'), TARGET)).toBe(true)
    expect(mockedFindFirst).not.toHaveBeenCalled()
  })

  it('HR_ADMIN 은 자사 직원만 평가', async () => {
    targetInCompany(true)
    expect(await canWriteEmployeeSkills(user('HR_ADMIN'), TARGET)).toBe(true)
    targetInCompany(false)
    expect(await canWriteEmployeeSkills(user('HR_ADMIN'), TARGET)).toBe(false)
  })

  it('MANAGER 는 현재 직속부하만 평가 (보고라인 + 자사 active primary 재필터)', async () => {
    mockedIsManager.mockResolvedValue(true)
    targetInCompany(true) // 자사 active primary 발령 보유
    expect(await canWriteEmployeeSkills(user('MANAGER'), TARGET)).toBe(true)
    expect(mockedIsManager).toHaveBeenCalledWith(SELF, TARGET)
    // 재필터는 S324 형상 + status denylist(RESIGNED/TERMINATED 제외 — ON_LEAVE 는 평가 대상)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const some = (mockedFindFirst.mock.calls[0]?.[0] as any)?.where?.assignments?.some
    expect(some.status).toEqual({ notIn: ['RESIGNED', 'TERMINATED'] })
    expect(some.companyId).toBe(CO)
    expect(some.effectiveDate).toEqual({ lte: expect.any(Date) })
  })

  it('MANAGER 는 비-직속부하(자사 포함) 평가 차단 — 수평권한 상승 방지', async () => {
    mockedIsManager.mockResolvedValue(false)
    expect(await canWriteEmployeeSkills(user('MANAGER'), TARGET)).toBe(false)
    expect(mockedFindFirst).not.toHaveBeenCalled() // 보고라인 탈락 시 재필터 조회 없음
  })

  it('MANAGER 는 직속부하라도 자사 active primary 발령 아니면 차단 (오프보딩 진행중·타법인)', async () => {
    mockedIsManager.mockResolvedValue(true)
    targetInCompany(false) // 재필터 미통과 (RESIGNED·전출 등)
    expect(await canWriteEmployeeSkills(user('MANAGER'), TARGET)).toBe(false)
  })

  it('EXECUTIVE·EMPLOYEE 는 평가 불가 (기존 canEval 집합 유지)', async () => {
    expect(await canWriteEmployeeSkills(user('EXECUTIVE'), TARGET)).toBe(false)
    expect(await canWriteEmployeeSkills(user('EMPLOYEE'), TARGET)).toBe(false)
  })
})
