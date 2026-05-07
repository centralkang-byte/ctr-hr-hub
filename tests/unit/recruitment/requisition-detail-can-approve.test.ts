// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/recruitment/requisitions/[id] canApprove field
//
// Session 206 follow-up (P2) — multi-role 인지 server-derived hint.
// detail GET 응답에 server validator(isRequisitionApproverAllowed) 결과를 그대로
// 노출해 client UI helper의 single-role JWT pin 한계로 인한 false-deny 차단.
//
// 본 테스트는 prisma + validator + getServerSession을 mock해 GET handler를 직접
// 호출. notFound masking + canApprove 필드 출력 두 layer를 분리 검증.
//
// 회귀 차단 핵심 case: HR_ADMIN base + 보조 MANAGER role(active EmployeeRole) 사용자가
// direct_manager step requisition 진입 — server validator는 multi-role로 true 반환
// → 응답 canApprove=true → detail page 결재 버튼 노출. 이전엔 client helper가 user.role
// 단일 pin('HR_ADMIN')을 보고 dept_head/direct_manager step 분기에서 false 반환 →
// 버튼 숨김. server-derived field는 validator 결과를 직접 신뢰.
// ═══════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    requisition: {
      findFirst: vi.fn(),
    },
  },
}))

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

vi.mock('@/lib/approval/validate-requisition-approver', () => ({
  isRequisitionApproverAllowed: vi.fn(),
}))

import { GET } from '@/app/api/v1/recruitment/requisitions/[id]/route'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { isRequisitionApproverAllowed } from '@/lib/approval/validate-requisition-approver'
import type { NextRequest } from 'next/server'

const mockedFindFirst = vi.mocked(prisma.requisition.findFirst)
const mockedSession = vi.mocked(getServerSession)
const mockedValidator = vi.mocked(isRequisitionApproverAllowed)

const REQ_ID = 'requisition-1'
const COMPANY_ID = 'company-A'
const REQUESTER_ID = 'employee-requester'
const USER_ID = 'employee-user'

function makeContext() {
  return { params: Promise.resolve({ id: REQ_ID }) }
}

function makeRequest(): NextRequest {
  // GET handler는 req body를 사용하지 않음 — 빈 객체 캐스팅이면 충분.
  return {} as NextRequest
}

function makeRequisition(opts: {
  status: 'pending' | 'approved' | 'rejected' | 'draft' | 'cancelled' | 'filled'
  currentStep: number
  approverRole: 'hr_admin' | 'direct_manager' | 'dept_head' | 'ceo' | 'finance'
  recordStatus?: 'pending' | 'approved' | 'rejected'
}) {
  return {
    id: REQ_ID,
    reqNumber: 'REQ-001',
    title: 'Test Requisition',
    urgency: 'normal',
    status: opts.status,
    headcount: 1,
    employmentType: 'permanent',
    currentStep: opts.currentStep,
    companyId: COMPANY_ID,
    departmentId: 'dept-1',
    requesterId: REQUESTER_ID,
    createdAt: new Date(),
    company: { id: COMPANY_ID, name: 'CTR' },
    department: { id: 'dept-1', name: 'Engineering' },
    requester: { id: REQUESTER_ID, name: '한지영', nameEn: null, photoUrl: null },
    position: null,
    approvalRecords: [
      {
        id: 'record-1',
        stepOrder: opts.currentStep,
        approverRole: opts.approverRole,
        status: opts.recordStatus ?? 'pending',
        approver: null,
      },
    ],
    jobPostings: [],
  }
}

function makeUser(overrides: {
  role: string
  permissions?: Array<{ module: string; action: string }>
  companyId?: string
}) {
  return {
    id: USER_ID,
    employeeId: USER_ID,
    email: 'user@example.com',
    name: 'Test User',
    companyId: COMPANY_ID,
    employeeNumber: 'E0001',
    permissions: overrides.permissions ?? [],
    ...overrides,
  }
}

// MODULE.RECRUITMENT = 'recruitment', ACTION.VIEW = 'read' (constants.ts).
const VIEWER_PERMS = [{ module: 'recruitment', action: 'read' }]

describe('GET /requisitions/[id] — canApprove field', () => {
  beforeEach(() => {
    mockedFindFirst.mockReset()
    mockedSession.mockReset()
    mockedValidator.mockReset()
  })

  it('SUPER_ADMIN sees canApprove=true on pending requisition (validator short-circuits)', async () => {
    mockedSession.mockResolvedValue({
      user: makeUser({ role: 'SUPER_ADMIN' }),
    } as never)
    mockedFindFirst.mockResolvedValue(
      makeRequisition({ status: 'pending', currentStep: 1, approverRole: 'hr_admin' }) as never,
    )
    mockedValidator.mockResolvedValue(true)

    const res = await GET(makeRequest(), makeContext())
    const body = (await res.json()) as { data: { canApprove: boolean } }
    expect(res.status).toBe(200)
    expect(body.data.canApprove).toBe(true)
    expect(mockedValidator).toHaveBeenCalledTimes(1)
  })

  it('HR_ADMIN viewer + not approver returns canApprove=false but 200 (viewer access)', async () => {
    mockedSession.mockResolvedValue({
      user: makeUser({ role: 'HR_ADMIN', permissions: VIEWER_PERMS }),
    } as never)
    mockedFindFirst.mockResolvedValue(
      makeRequisition({ status: 'pending', currentStep: 1, approverRole: 'direct_manager' }) as never,
    )
    mockedValidator.mockResolvedValue(false)

    const res = await GET(makeRequest(), makeContext())
    const body = (await res.json()) as { data: { canApprove: boolean } }
    expect(res.status).toBe(200)
    expect(body.data.canApprove).toBe(false)
  })

  // === The fix: multi-role HR_ADMIN+MANAGER on direct_manager step ===
  it('multi-role user (HR_ADMIN base + MANAGER active) sees canApprove=true on direct_manager step (regression for Session 206 follow-up)', async () => {
    mockedSession.mockResolvedValue({
      user: makeUser({ role: 'HR_ADMIN', permissions: VIEWER_PERMS }),
    } as never)
    mockedFindFirst.mockResolvedValue(
      makeRequisition({ status: 'pending', currentStep: 1, approverRole: 'direct_manager' }) as never,
    )
    // validator는 active EmployeeRoles + position 관계 검증으로 true (사용자가 실제 직속 상사).
    mockedValidator.mockResolvedValue(true)

    const res = await GET(makeRequest(), makeContext())
    const body = (await res.json()) as { data: { canApprove: boolean } }
    expect(res.status).toBe(200)
    // 회귀 차단: client helper는 HR_ADMIN base + direct_manager step에서 false 반환
    // (single-role JWT pin), 그러나 server-derived field는 validator 결과 그대로 신뢰.
    expect(body.data.canApprove).toBe(true)
  })

  it('non-pending status (approved) returns canApprove=false (no pending currentRecord)', async () => {
    mockedSession.mockResolvedValue({
      user: makeUser({ role: 'HR_ADMIN', permissions: VIEWER_PERMS }),
    } as never)
    mockedFindFirst.mockResolvedValue(
      makeRequisition({
        status: 'approved',
        currentStep: 1,
        approverRole: 'hr_admin',
        recordStatus: 'approved', // currentRecord filter는 status='pending'만 매칭
      }) as never,
    )

    const res = await GET(makeRequest(), makeContext())
    const body = (await res.json()) as { data: { canApprove: boolean } }
    expect(res.status).toBe(200)
    expect(body.data.canApprove).toBe(false)
    // currentRecord 부재 → validator 호출 안 됨 (short-circuit).
    expect(mockedValidator).not.toHaveBeenCalled()
  })

  it('non-viewer + non-requester + non-approver returns 404 (notFound masking 보존, Session 202)', async () => {
    mockedSession.mockResolvedValue({
      user: makeUser({ role: 'EMPLOYEE' }),
    } as never)
    mockedFindFirst.mockResolvedValue(
      makeRequisition({ status: 'pending', currentStep: 1, approverRole: 'hr_admin' }) as never,
    )
    mockedValidator.mockResolvedValue(false) // 아닌 결재자

    const res = await GET(makeRequest(), makeContext())
    expect(res.status).toBe(404)
  })

  it('non-viewer + requester (본인 요청) returns 200 + canApprove=false (자기 결재 불가)', async () => {
    mockedSession.mockResolvedValue({
      // user.employeeId === requester.id
      user: makeUser({ role: 'EMPLOYEE' }),
    } as never)
    mockedFindFirst.mockResolvedValue(
      makeRequisition({ status: 'pending', currentStep: 1, approverRole: 'hr_admin' }) as never,
    )
    // requester == user, requester는 결재자 아님 → validator도 false
    mockedValidator.mockResolvedValue(false)

    // requester id와 user id 일치 시나리오 — makeUser 기본은 USER_ID, requester도 USER_ID로 override.
    const reqWithSameRequester = {
      ...makeRequisition({ status: 'pending', currentStep: 1, approverRole: 'hr_admin' }),
      requesterId: USER_ID,
      requester: { id: USER_ID, name: 'Self', nameEn: null, photoUrl: null },
    }
    mockedFindFirst.mockResolvedValueOnce(reqWithSameRequester as never)

    const res = await GET(makeRequest(), makeContext())
    const body = (await res.json()) as { data: { canApprove: boolean } }
    expect(res.status).toBe(200)
    expect(body.data.canApprove).toBe(false)
  })

  it('SUPER_ADMIN bypasses companyId scope (cross-company viewer access)', async () => {
    mockedSession.mockResolvedValue({
      user: makeUser({ role: 'SUPER_ADMIN', companyId: 'company-OTHER' }),
    } as never)
    mockedFindFirst.mockResolvedValue(
      makeRequisition({ status: 'pending', currentStep: 1, approverRole: 'hr_admin' }) as never,
    )
    mockedValidator.mockResolvedValue(true)

    const res = await GET(makeRequest(), makeContext())
    expect(res.status).toBe(200)
    // findFirst 호출 시 SUPER_ADMIN은 companyId scope 부재.
    const where = (mockedFindFirst.mock.calls[0]?.[0] as { where: Record<string, unknown> } | undefined)?.where
    expect(where?.companyId).toBeUndefined()
  })
})
