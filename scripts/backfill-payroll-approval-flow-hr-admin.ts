// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Backfill Payroll ApprovalFlow (dept_head → hr_admin)
//
// 일회성 스크립트. 글로벌 payroll ApprovalFlow의 1단계 승인자를
// dept_head → hr_admin 으로 교정한다.
//
// 배경: payroll run은 전사 단위(단일 대상 직원 없음)라 dept_head/direct_manager
// (대상 직원 기준 해석)는 resolve 불가. 회사 단위 role(hr_admin/ceo/finance)만 유효.
// 시드(42-approval-flow-defaults.ts)는 이미 hr_admin으로 갱신됐으나, 기존에 시드된
// DB의 글로벌 flow는 idempotent seed의 existing-skip 때문에 자동 갱신되지 않으므로
// 본 스크립트로 명시적 갱신한다.
//
// 안전장치:
//   - 글로벌 flow(companyId = null)만 대상. 법인별 커스텀 flow는 절대 건드리지 않음.
//   - steps가 정확히 old-shape [dept_head@1, ceo@2]일 때만 교체 (다른 형태면 skip).
//   - DRY_RUN=true 면 변경 없이 영향만 출력.
//
// 실행:
//   DRY_RUN=true npx tsx scripts/backfill-payroll-approval-flow-hr-admin.ts
//   npx tsx scripts/backfill-payroll-approval-flow-hr-admin.ts
// ═══════════════════════════════════════════════════════════

import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })
dotenv.config({ path: path.resolve(__dirname, '..', '.env') })
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const dbUrl = process.env.DATABASE_URL
if (!dbUrl) throw new Error('DATABASE_URL not set')
const adapter = new PrismaPg({ connectionString: dbUrl })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma: PrismaClient = new (PrismaClient as any)({ adapter })

const DRY_RUN = process.env.DRY_RUN === 'true'

async function main() {
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  Backfill Payroll ApprovalFlow (dept_head → hr_admin)${DRY_RUN ? '  [DRY_RUN]' : ''}`)
  console.log(`${'═'.repeat(60)}\n`)

  // 글로벌 payroll flow만 (법인별 커스텀 flow는 보존)
  const flows = await prisma.approvalFlow.findMany({
    where: { module: 'payroll', companyId: null, deletedAt: null },
    include: { steps: { orderBy: { stepOrder: 'asc' } } },
  })

  if (flows.length === 0) {
    console.log('⚠️  글로벌 payroll ApprovalFlow 없음 — 갱신 대상 없음.')
    return
  }

  let updated = 0
  let skipped = 0

  for (const flow of flows) {
    const shape = flow.steps.map((s) => s.approverRole)
    const isOldShape =
      flow.steps.length === 2 &&
      flow.steps[0]?.stepOrder === 1 &&
      flow.steps[0]?.approverRole === 'dept_head' &&
      flow.steps[1]?.approverRole === 'ceo'

    if (!isOldShape) {
      console.log(`  ⏭  flow ${flow.id} skip — shape=[${shape.join(', ')}] (old-shape 아님; 이미 갱신/커스텀)`)
      skipped++
      continue
    }

    const step1 = flow.steps[0]
    console.log(`  ✏️  flow ${flow.id}: step1 dept_head → hr_admin (step2 ceo 유지)`)
    if (!DRY_RUN) {
      await prisma.approvalFlowStep.update({
        where: { id: step1.id },
        data: { approverRole: 'hr_admin' },
      })
    }
    updated++
  }

  console.log(`\n  결과: ${updated} updated, ${skipped} skipped${DRY_RUN ? ' (DRY_RUN — 실제 변경 없음)' : ''}\n`)
}

main()
  .catch((e) => {
    console.error('❌ Backfill 실패:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
