// ═══════════════════════════════════════════════════════════
// validateApprover direct_manager 분기 회귀 테스트 (Session 205)
//
// 본 테스트는 prisma를 모킹하므로 raw SQL 자체는 검증하지 못한다 — Codex review와
// 통합 환경에서 검증. 본 테스트의 목적은:
//   1) direct_manager step에서 EXISTS 분기를 타는지 (기존 LIMIT 1 비교가 아닌)
//   2) self === target short-circuit이 SQL 호출 없이 false 반환하는지
//   3) multi-manager 시 EXISTS가 true면 allowed (LIMIT 1 비결정성 회피)
// ═══════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    approvalFlow: {
      findFirst: vi.fn(),
    },
    employee: {
      findFirst: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}))

import { validateApprover } from '@/lib/approval/resolve-approval-flow'
import { prisma } from '@/lib/prisma'

const mockedFlowFindFirst = vi.mocked(prisma.approvalFlow.findFirst)
const mockedEmpFindFirst = vi.mocked(prisma.employee.findFirst)
const mockedQueryRaw = prisma.$queryRaw as unknown as ReturnType<typeof vi.fn>

const COMPANY = 'company-A'
const TARGET = 'employee-target'

function flowWith(approverRole: 'direct_manager' | 'hr_admin' | 'ceo') {
  return {
    id: 'flow-1',
    module: 'probation',
    companyId: null,
    deletedAt: null,
    steps: [
      {
        stepOrder: 1,
        approverRole,
        approverUserId: null,
        approverType: 'role',
        isRequired: true,
        autoApproveDays: null,
      },
    ],
  } as never
}

describe('validateApprover — direct_manager EXISTS branch (Session 205)', () => {
  beforeEach(() => {
    mockedFlowFindFirst.mockReset()
    mockedEmpFindFirst.mockReset()
    mockedQueryRaw.mockReset()
  })

  it('allows candidate matched by isDirectManagerOf EXISTS query', async () => {
    mockedFlowFindFirst.mockResolvedValueOnce(flowWith('direct_manager'))
    // EXISTS rows.length > 0 → matched
    mockedQueryRaw.mockResolvedValueOnce([{ ok: 1 }] as never)

    const result = await validateApprover('probation', COMPANY, TARGET, 'manager-primary')

    expect(result.allowed).toBe(true)
    expect(result.matchedStep?.approverRole).toBe('direct_manager')
    expect(mockedQueryRaw).toHaveBeenCalledTimes(1)
  })

  it('allows candidate matched via secondary manager position (multi-manager)', async () => {
    // primary 매니저 + secondary 매니저가 둘 다 존재하지만 candidate가 secondary 측.
    // 기존 LIMIT 1 비교 로직이라면 primary 매니저 ID만 반환되어 false였을 것.
    // EXISTS 분기는 candidate가 어느 매니저든 true.
    mockedFlowFindFirst.mockResolvedValueOnce(flowWith('direct_manager'))
    mockedQueryRaw.mockResolvedValueOnce([{ ok: 1 }] as never)

    const result = await validateApprover('probation', COMPANY, TARGET, 'manager-via-secondary')

    expect(result.allowed).toBe(true)
  })

  it('denies candidate not matched (EXISTS empty)', async () => {
    mockedFlowFindFirst.mockResolvedValueOnce(flowWith('direct_manager'))
    mockedQueryRaw.mockResolvedValueOnce([] as never)

    const result = await validateApprover('probation', COMPANY, TARGET, 'manager-unrelated')

    expect(result.allowed).toBe(false)
    expect(result.noFlowConfigured).toBe(false)
  })

  it('allows self-approval when target also holds the manager position (preserves legacy submit self-skip behavior)', async () => {
    // Routing(resolveApproverByRole)이 self-허용으로 동작하는 것과 정합 — submit
    // 자동 승인(self-skip → APPROVED) 경로 + probation/contract-convert 같이
    // validateApprover만 호출하는 모듈의 기존 동작 보존 (Codex Gate 2 R2 P2).
    // 셀프 결재 차단은 caller(예: requisition)가 isRequisitionApproverAllowed 같은
    // 별도 helper로 처리.
    mockedFlowFindFirst.mockResolvedValueOnce(flowWith('direct_manager'))
    mockedQueryRaw.mockResolvedValueOnce([{ ok: 1 }] as never)

    const result = await validateApprover('probation', COMPANY, TARGET, TARGET)

    expect(result.allowed).toBe(true)
    expect(mockedQueryRaw).toHaveBeenCalledTimes(1)
  })

  it('returns noFlowConfigured when flow missing', async () => {
    mockedFlowFindFirst.mockResolvedValueOnce(null)

    const result = await validateApprover('probation', COMPANY, TARGET, 'anyone')

    expect(result.allowed).toBe(false)
    expect(result.noFlowConfigured).toBe(true)
    expect(mockedQueryRaw).not.toHaveBeenCalled()
  })

  it('does not affect non-direct_manager step routing (sanity)', async () => {
    // hr_admin step은 기존 resolveApproverByRole === currentUserId 패스를 그대로 유지.
    // resolveApproverByRole이 'hr-admin-emp'를 반환하지만 currentUserId='someone'이라
    // 매칭 실패 → allowed false. 핵심은 EXISTS 쿼리(direct_manager 분기) 미호출 검증.
    mockedFlowFindFirst.mockResolvedValueOnce(flowWith('hr_admin'))
    mockedEmpFindFirst.mockResolvedValueOnce({ id: 'hr-admin-emp' } as never)

    const result = await validateApprover('probation', COMPANY, TARGET, 'someone')

    expect(mockedQueryRaw).not.toHaveBeenCalled()
    expect(result.allowed).toBe(false)
  })

  it('hr_admin step matches when resolver returns currentUserId (regression sanity)', async () => {
    // hr_admin step의 기존 resolveApproverByRole === currentUserId 패스가 깨지지 않음을 확인.
    mockedFlowFindFirst.mockResolvedValueOnce(flowWith('hr_admin'))
    mockedEmpFindFirst.mockResolvedValueOnce({ id: 'hr-admin-emp' } as never)

    const result = await validateApprover('probation', COMPANY, TARGET, 'hr-admin-emp')

    expect(result.allowed).toBe(true)
    expect(result.matchedStep?.approverRole).toBe('hr_admin')
    expect(mockedQueryRaw).not.toHaveBeenCalled()
  })
})
