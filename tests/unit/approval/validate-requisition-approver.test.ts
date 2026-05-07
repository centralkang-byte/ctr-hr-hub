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

// Session 207: validator가 active-roles helper를 호출 → 기본 mock으로 빈 set 반환.
// per-test로 multi-role 시나리오는 mockResolvedValueOnce로 override.
vi.mock('@/lib/employee/active-roles', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/employee/active-roles')>(
      '@/lib/employee/active-roles',
    )
  return {
    ...actual,
    // helper만 mock (DB 호출 분기) — buildEffectiveRoleCodes/getEligibleApprover...는
    // 순수 함수라 actual 사용.
    getActiveRoleCodes: vi.fn().mockResolvedValue(new Set<string>()),
  }
})

import { isRequisitionApproverAllowed } from '@/lib/approval/validate-requisition-approver'
import { prisma } from '@/lib/prisma'
import { getActiveRoleCodes } from '@/lib/employee/active-roles'

const mockedDeptFindFirst = vi.mocked(prisma.department.findFirst)
// $queryRaw는 tagged template이라 vi.mocked 시그니처와 충돌 — 직접 캐스팅.
const mockedQueryRaw = prisma.$queryRaw as unknown as ReturnType<typeof vi.fn>
const mockedGetActiveRoleCodes = vi.mocked(getActiveRoleCodes)

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
    mockedGetActiveRoleCodes.mockReset()
    // Default: 빈 active role set (각 test가 필요시 override).
    mockedGetActiveRoleCodes.mockResolvedValue(new Set<string>())
  })

  describe('SUPER_ADMIN bypass', () => {
    it('allows any approverRole regardless of company (JWT pin)', async () => {
      // 기존 동작 보존: SUPER_ADMIN session.role pin 기반 cross-company 결재 허용.
      // myApprovals route는 SUPER_ADMIN + companyId 쿼리파라미터로 명시 cross-company
      // 결재 path를 노출하므로 본 validator도 이를 거부하지 않음 (Session 207 Codex
      // Gate 2 R1 P1 회귀 fix).
      const user = makeUser({ role: 'SUPER_ADMIN', companyId: 'company-OTHER' })
      for (const role of ['hr_admin', 'ceo', 'direct_manager', 'dept_head', 'unknown_role']) {
        const result = await isRequisitionApproverAllowed({
          user,
          approverRole: role,
          requisition: baseRequisition,
        })
        expect(result, `role=${role}`).toBe(true)
      }
      // SUPER_ADMIN session bypass는 가장 먼저 short-circuit — DB 미호출.
      expect(mockedDeptFindFirst).not.toHaveBeenCalled()
      expect(mockedQueryRaw).not.toHaveBeenCalled()
      expect(mockedGetActiveRoleCodes).not.toHaveBeenCalled()
    })

    it('allows stale-session SUPER_ADMIN for hr_admin/ceo steps only (matches list)', async () => {
      // session.role이 EMPLOYEE인데 active EmployeeRole에 SUPER_ADMIN 보유 — JWT 미갱신
      // stale 시나리오. matcher SSOT(getEligibleApproverRolesForRequisition)가 SUPER_ADMIN
      // → hr_admin/ceo로 매핑하므로 validator도 이 두 step은 자동 통과 (list/validator
      // drift 차단 — Codex Gate 2 R2 P2). direct_manager/dept_head는 실제 관계 검증.
      mockedGetActiveRoleCodes.mockResolvedValueOnce(new Set(['SUPER_ADMIN']))
      const user = makeUser({ role: 'EMPLOYEE', companyId: 'company-A' })
      const result = await isRequisitionApproverAllowed({
        user,
        approverRole: 'hr_admin',
        requisition: baseRequisition,
      })
      expect(result).toBe(true)
    })

    it('blocks stale-session SUPER_ADMIN for direct_manager/dept_head step (real relation required)', async () => {
      // SUPER_ADMIN session.role이 아닌 stale 사용자는 direct_manager/dept_head step에서
      // 실제 관계(position hierarchy / Department.headEmployeeId)로만 검증. SUPER_ADMIN
      // 보유 자체는 hr_admin/ceo로 매핑되어 다른 step에는 영향 없음.
      mockedGetActiveRoleCodes.mockResolvedValueOnce(new Set(['SUPER_ADMIN']))
      mockedDeptFindFirst.mockResolvedValueOnce(null as never)
      const user = makeUser({ role: 'EMPLOYEE', companyId: 'company-A' })
      const result = await isRequisitionApproverAllowed({
        user,
        approverRole: 'dept_head',
        requisition: baseRequisition,
      })
      expect(result).toBe(false)
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
        // 다른 단일 role + 빈 active EmployeeRoles → 차단.
        mockedGetActiveRoleCodes.mockResolvedValueOnce(new Set<string>())
        const user = makeUser({ role })
        const result = await isRequisitionApproverAllowed({
          user,
          approverRole: 'hr_admin',
          requisition: baseRequisition,
        })
        expect(result, `role=${role}`).toBe(false)
      }
    })

    // Session 207: 멀티롤 employee — SessionUser.role은 단일 pin이지만 EmployeeRole에
    // HR_ADMIN을 추가로 보유한 경우 hr_admin step 결재 가능해야 함.
    it('allows MANAGER session with HR_ADMIN active EmployeeRole (multi-role)', async () => {
      mockedGetActiveRoleCodes.mockResolvedValueOnce(
        new Set(['MANAGER', 'HR_ADMIN']),
      )
      const user = makeUser({ role: 'MANAGER' })
      const result = await isRequisitionApproverAllowed({
        user,
        approverRole: 'hr_admin',
        requisition: baseRequisition,
      })
      expect(result).toBe(true)
    })

    it('allows EMPLOYEE session with HR_ADMIN active EmployeeRole (stale session safety)', async () => {
      // SessionUser.role이 stale (HR_ADMIN role이 추가됐는데 JWT 미갱신) 시나리오 —
      // helper의 live DB 조회로 보강.
      mockedGetActiveRoleCodes.mockResolvedValueOnce(new Set(['HR_ADMIN']))
      const user = makeUser({ role: 'EMPLOYEE' })
      const result = await isRequisitionApproverAllowed({
        user,
        approverRole: 'hr_admin',
        requisition: baseRequisition,
      })
      expect(result).toBe(true)
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
        mockedGetActiveRoleCodes.mockResolvedValueOnce(new Set<string>())
        const user = makeUser({ role })
        const result = await isRequisitionApproverAllowed({
          user,
          approverRole: 'ceo',
          requisition: baseRequisition,
        })
        expect(result, `role=${role}`).toBe(false)
      }
    })

    // Session 207: 멀티롤 — EXECUTIVE를 보조 EmployeeRole로 보유.
    it('allows MANAGER session with EXECUTIVE active EmployeeRole (multi-role)', async () => {
      mockedGetActiveRoleCodes.mockResolvedValueOnce(
        new Set(['MANAGER', 'EXECUTIVE']),
      )
      const user = makeUser({ role: 'MANAGER' })
      const result = await isRequisitionApproverAllowed({
        user,
        approverRole: 'ceo',
        requisition: baseRequisition,
      })
      expect(result).toBe(true)
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

    // Session 206: status='ACTIVE' 제거 → ON_LEAVE 매니저/요청자도 결재 진행 가능.
    // SQL은 endDate=null 만으로 "현재" assignment를 식별하며, ON_LEAVE는 endDate=null
    // 인 새 assignment를 보유 → mgr_asg/req_asg 매칭 통과. RESIGNED/TERMINATED는
    // endDate가 설정되어 자연 제외 (이 케이스는 mock이 빈 배열 반환 시 차단).
    it('allows ON_LEAVE manager to approve direct report requisition (Session 206)', async () => {
      // SQL이 mgr_asg 행을 반환 (status='ON_LEAVE'여도 endDate=null이므로 매칭).
      mockedQueryRaw.mockResolvedValueOnce([{ ok: 1 }] as never)
      const user = makeUser({ role: 'MANAGER', employeeId: 'manager-on-leave' })
      const result = await isRequisitionApproverAllowed({
        user,
        approverRole: 'direct_manager',
        requisition: baseRequisition,
      })
      expect(result).toBe(true)
    })

    it('allows ACTIVE manager to approve ON_LEAVE requester requisition (Session 206)', async () => {
      // requester가 ON_LEAVE여도 req_asg.endDate IS NULL 매칭으로 결재 진행 가능.
      // 휴직 중 요청자의 결재 stuck 차단 (state machine progress).
      mockedQueryRaw.mockResolvedValueOnce([{ ok: 1 }] as never)
      const user = makeUser({ role: 'MANAGER', employeeId: 'manager-active' })
      const result = await isRequisitionApproverAllowed({
        user,
        approverRole: 'direct_manager',
        requisition: baseRequisition,
      })
      expect(result).toBe(true)
    })

    // Session 206 Codex Gate 2 P1: in-progress offboarding 차단.
    // `offboarding/start`는 status를 RESIGNED/TERMINATED로 변경하지만 endDate는
    // last working date까지 그대로 둔다 → endDate=null 만으로는 lifecycle 식별 부족.
    // SQL의 status IN ('ACTIVE', 'ON_LEAVE') allowlist가 이 케이스를 차단.
    it('blocks RESIGNED manager from approving (in-progress offboarding)', async () => {
      // RESIGNED 매니저: status='RESIGNED' assignment는 SQL allowlist 매칭 실패 → 0 row.
      mockedQueryRaw.mockResolvedValueOnce([] as never)
      const user = makeUser({ role: 'MANAGER', employeeId: 'manager-resigned' })
      const result = await isRequisitionApproverAllowed({
        user,
        approverRole: 'direct_manager',
        requisition: baseRequisition,
      })
      expect(result).toBe(false)
    })

    it('blocks approval of TERMINATED requester requisition (in-progress offboarding)', async () => {
      // TERMINATED 요청자: req_asg.status='TERMINATED' 매칭 실패 → 0 row.
      mockedQueryRaw.mockResolvedValueOnce([] as never)
      const user = makeUser({ role: 'MANAGER', employeeId: 'manager-active' })
      const result = await isRequisitionApproverAllowed({
        user,
        approverRole: 'direct_manager',
        requisition: baseRequisition,
      })
      expect(result).toBe(false)
    })
  })
})
