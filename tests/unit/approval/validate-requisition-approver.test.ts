import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SessionUser } from '@/types'

// prisma 메서드를 per-test로 제어하기 위해 모듈 모킹.
// vitest config의 default mock(recursive proxy)을 덮어쓴다.
vi.mock('@/lib/prisma', () => ({
  prisma: {
    department: {
      findFirst: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}))

import { isRequisitionApproverAllowed } from '@/lib/approval/validate-requisition-approver'
import { prisma } from '@/lib/prisma'

const mockedDeptFindFirst = vi.mocked(prisma.department.findFirst)
// $queryRaw는 tagged template이라 vi.mocked 시그니처와 충돌 — 직접 캐스팅.
const mockedQueryRaw = prisma.$queryRaw as unknown as ReturnType<typeof vi.fn>

const baseRequisition = {
  companyId: 'company-A',
  departmentId: 'dept-1',
  requesterId: 'employee-requester',
}

function makeUser(overrides: Partial<SessionUser>): SessionUser {
  return {
    id: 'user-id',
    employeeId: 'employee-user',
    email: 'user@example.com',
    name: 'Test User',
    role: 'EMPLOYEE',
    companyId: 'company-A',
    employeeNumber: 'E0001',
    ...overrides,
  } as SessionUser
}

describe('isRequisitionApproverAllowed', () => {
  beforeEach(() => {
    mockedDeptFindFirst.mockReset()
    mockedQueryRaw.mockReset()
  })

  describe('SUPER_ADMIN bypass', () => {
    it('allows any approverRole regardless of company', async () => {
      const user = makeUser({ role: 'SUPER_ADMIN', companyId: 'company-OTHER' })
      for (const role of ['hr_admin', 'ceo', 'direct_manager', 'dept_head', 'unknown_role']) {
        const result = await isRequisitionApproverAllowed({
          user,
          approverRole: role,
          requisition: baseRequisition,
        })
        expect(result).toBe(true)
      }
      // SUPER_ADMIN 경로에선 DB 미호출
      expect(mockedDeptFindFirst).not.toHaveBeenCalled()
      expect(mockedQueryRaw).not.toHaveBeenCalled()
    })
  })

  describe('Cross-tenant guard', () => {
    it('blocks non-SUPER_ADMIN with mismatched companyId', async () => {
      const user = makeUser({ role: 'HR_ADMIN', companyId: 'company-OTHER' })
      const result = await isRequisitionApproverAllowed({
        user,
        approverRole: 'hr_admin',
        requisition: baseRequisition,
      })
      expect(result).toBe(false)
    })
  })

  describe('null/unknown approverRole', () => {
    it('returns false for null approverRole', async () => {
      const user = makeUser({ role: 'HR_ADMIN' })
      const result = await isRequisitionApproverAllowed({
        user,
        approverRole: null,
        requisition: baseRequisition,
      })
      expect(result).toBe(false)
    })

    it('returns false for unknown approverRole (e.g. specific_user)', async () => {
      const user = makeUser({ role: 'HR_ADMIN' })
      const result = await isRequisitionApproverAllowed({
        user,
        approverRole: 'specific_user',
        requisition: baseRequisition,
      })
      expect(result).toBe(false)
    })
  })

  describe('hr_admin step', () => {
    it('allows HR_ADMIN', async () => {
      const user = makeUser({ role: 'HR_ADMIN' })
      const result = await isRequisitionApproverAllowed({
        user,
        approverRole: 'hr_admin',
        requisition: baseRequisition,
      })
      expect(result).toBe(true)
    })

    it('blocks MANAGER, EXECUTIVE, EMPLOYEE', async () => {
      for (const role of ['MANAGER', 'EXECUTIVE', 'EMPLOYEE'] as const) {
        const user = makeUser({ role })
        const result = await isRequisitionApproverAllowed({
          user,
          approverRole: 'hr_admin',
          requisition: baseRequisition,
        })
        expect(result, `role=${role}`).toBe(false)
      }
    })
  })

  describe('ceo step', () => {
    it('allows EXECUTIVE', async () => {
      const user = makeUser({ role: 'EXECUTIVE' })
      const result = await isRequisitionApproverAllowed({
        user,
        approverRole: 'ceo',
        requisition: baseRequisition,
      })
      expect(result).toBe(true)
    })

    it('blocks HR_ADMIN, MANAGER, EMPLOYEE', async () => {
      for (const role of ['HR_ADMIN', 'MANAGER', 'EMPLOYEE'] as const) {
        const user = makeUser({ role })
        const result = await isRequisitionApproverAllowed({
          user,
          approverRole: 'ceo',
          requisition: baseRequisition,
        })
        expect(result, `role=${role}`).toBe(false)
      }
    })
  })

  describe('dept_head step', () => {
    it('allows MANAGER who is the department head', async () => {
      mockedDeptFindFirst.mockResolvedValueOnce({ id: 'dept-1' } as never)
      const user = makeUser({ role: 'MANAGER', employeeId: 'manager-1' })
      const result = await isRequisitionApproverAllowed({
        user,
        approverRole: 'dept_head',
        requisition: baseRequisition,
      })
      expect(result).toBe(true)
      expect(mockedDeptFindFirst).toHaveBeenCalledWith({
        where: {
          id: 'dept-1',
          companyId: 'company-A',
          headEmployeeId: 'manager-1',
          deletedAt: null,
        },
        select: { id: true },
      })
    })

    it('blocks MANAGER who is not the department head', async () => {
      mockedDeptFindFirst.mockResolvedValueOnce(null as never)
      const user = makeUser({ role: 'MANAGER', employeeId: 'manager-stranger' })
      const result = await isRequisitionApproverAllowed({
        user,
        approverRole: 'dept_head',
        requisition: baseRequisition,
      })
      expect(result).toBe(false)
    })
  })

  describe('direct_manager step', () => {
    it('allows MANAGER who is the requester reportsTo', async () => {
      mockedQueryRaw.mockResolvedValueOnce([{ ok: 1 }] as never)
      const user = makeUser({ role: 'MANAGER', employeeId: 'manager-direct' })
      const result = await isRequisitionApproverAllowed({
        user,
        approverRole: 'direct_manager',
        requisition: baseRequisition,
      })
      expect(result).toBe(true)
      expect(mockedQueryRaw).toHaveBeenCalledTimes(1)
    })

    it('blocks MANAGER unrelated to requester', async () => {
      mockedQueryRaw.mockResolvedValueOnce([] as never)
      const user = makeUser({ role: 'MANAGER', employeeId: 'manager-unrelated' })
      const result = await isRequisitionApproverAllowed({
        user,
        approverRole: 'direct_manager',
        requisition: baseRequisition,
      })
      expect(result).toBe(false)
    })

    // Session 204: secondary 지원. SQL은 mocked이므로 raw SQL 자체 변경
    // (mgr_asg.is_primary 제거 + self-approval guard 추가)는 Codex review로 검증되며,
    // 본 테스트는 helper의 boolean 결과 계약(`rows.length > 0` → true) 회귀 방지.
    it('allows MANAGER holding manager position via secondary assignment (Session 204)', async () => {
      // SQL이 secondary mgr_asg row를 반환하는 시나리오 (primary=일반팀원, secondary=팀장).
      mockedQueryRaw.mockResolvedValueOnce([{ ok: 1 }] as never)
      const user = makeUser({ role: 'MANAGER', employeeId: 'manager-via-secondary' })
      const result = await isRequisitionApproverAllowed({
        user,
        approverRole: 'direct_manager',
        requisition: baseRequisition,
      })
      expect(result).toBe(true)
    })

    it('blocks self-approval via circular secondary assignment (Session 204 guard)', async () => {
      // requester 본인이 manager position을 secondary로 보유한 순환 구조에서도
      // SQL의 `mgr_asg.employee_id <> requesterId` 가드로 0 row 반환 → false.
      mockedQueryRaw.mockResolvedValueOnce([] as never)
      // user.employeeId === requester.employeeId 시나리오.
      const user = makeUser({ role: 'MANAGER', employeeId: baseRequisition.requesterId })
      const result = await isRequisitionApproverAllowed({
        user,
        approverRole: 'direct_manager',
        requisition: baseRequisition,
      })
      expect(result).toBe(false)
    })
  })
})
