/**
 * 42-approval-flow-defaults.ts
 * 위임전결규정(CP-A-03-04) 기반 모듈별 기본 결재 플로우 시드
 *
 * 규정 참조: docs/regulation-audit/A1-delegation-authority-matrix.md
 * - 휴가: 팀장(직속상관) 전결
 * - 급여: 본부장(dept_head) → 대표(ceo) 2단계
 * - 채용: 본부장(dept_head) 전결 (합의: HR)
 * - 징계: HR 기안 → 대표(ceo) 전결
 * - 증명서: 직속 팀장 전결
 * - 근태: 직속 팀장 전결
 * - 퇴직/사직: 본부장(dept_head) → 대표(ceo)  (A2 제32조)
 * - 인사발령: 대표(ceo) 전결  (A2 제33조)
 * - 수습 전환: 팀장 평가 → 본부장(dept_head)  (A2 제18조)
 * - 계약 전환: 팀장 평가 → 본부장(dept_head)  (A2 제15조)
 */

import { PrismaClient } from '../../src/generated/prisma/client'

interface FlowDef {
  module: string
  name: string
  steps: { approverRole: string; autoApproveDays?: number }[]
}

const DEFAULT_FLOWS: FlowDef[] = [
  {
    module: 'leave',
    name: '휴가 승인',
    steps: [{ approverRole: 'direct_manager' }],
  },
  {
    module: 'payroll',
    name: '급여 승인',
    steps: [
      { approverRole: 'dept_head' },
      { approverRole: 'ceo' },
    ],
  },
  {
    module: 'recruitment',
    name: '채용 승인',
    steps: [{ approverRole: 'dept_head' }],
  },
  {
    module: 'discipline',
    name: '징계 승인',
    steps: [
      { approverRole: 'hr_admin' },
      { approverRole: 'ceo' },
    ],
  },
  {
    module: 'certificate',
    name: '증명서 발급',
    steps: [{ approverRole: 'direct_manager' }],
  },
  {
    module: 'attendance',
    name: '근태 승인',
    steps: [{ approverRole: 'direct_manager' }],
  },
  {
    module: 'offboarding',
    name: '퇴직/사직 승인',
    steps: [
      { approverRole: 'dept_head' },
      { approverRole: 'ceo' },
    ],
  },
  {
    module: 'personnel_order',
    name: '인사발령 승인',
    steps: [{ approverRole: 'ceo' }],
  },
  {
    module: 'probation',
    name: '수습 전환 승인',
    steps: [
      { approverRole: 'direct_manager' },
      { approverRole: 'dept_head' },
    ],
  },
  {
    module: 'contract_conversion',
    name: '계약직 전환 승인',
    steps: [
      { approverRole: 'direct_manager' },
      { approverRole: 'dept_head' },
    ],
  },
]

export async function seedApprovalFlowDefaults(prisma: PrismaClient) {
  let created = 0
  let skipped = 0

  for (const flowDef of DEFAULT_FLOWS) {
    const existing = await prisma.approvalFlow.findFirst({
      where: { module: flowDef.module, companyId: null },
    })

    if (existing) {
      skipped++
      continue
    }

    await prisma.approvalFlow.create({
      data: {
        name: flowDef.name,
        module: flowDef.module,
        companyId: null,
        steps: {
          create: flowDef.steps.map((s, i) => ({
            stepOrder: i + 1,
            approverType: 'role',
            approverRole: s.approverRole,
            isRequired: true,
            autoApproveDays: s.autoApproveDays ?? null,
          })),
        },
      },
    })
    created++
  }

  console.log(`  ApprovalFlow defaults: ${created} created, ${skipped} skipped (already exist)`)
}
