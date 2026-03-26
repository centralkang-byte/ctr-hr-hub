// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Phase 6: EmployeeLeaveBalance → LeaveYearBalance 마이그레이션
//
// 1단계: 국내 법인에 누락된 annual LeaveTypeDef 생성
// 2단계: EmployeeLeaveBalance → LeaveYearBalance upsert (used/pending 동기화)
// 3단계: LeaveRequest.leaveTypeDefId null 백필
//
// 실행: npx tsx scripts/migrate-leave-balances.ts [--dry-run]
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

const DRY_RUN = process.argv.includes('--dry-run')

// LeaveType enum → LeaveTypeDef 매핑
const LEAVE_TYPE_MAP: Record<string, { code: string; category: string; name: string; nameEn: string }> = {
  ANNUAL:       { code: 'annual',       category: 'annual',  name: '연차유급휴가', nameEn: 'Annual Leave' },
  SICK:         { code: 'sick',         category: 'health',  name: '병가',         nameEn: 'Sick Leave' },
  SPECIAL:      { code: 'special',      category: 'other',   name: '특별휴가',     nameEn: 'Special Leave' },
  COMPENSATORY: { code: 'compensatory', category: 'other',   name: '보상휴가',     nameEn: 'Compensatory Leave' },
  MATERNITY:    { code: 'maternity_childbirth', category: 'maternity', name: '출산휴가', nameEn: 'Maternity Leave' },
  PATERNITY:    { code: 'childbirth_spouse',    category: 'family_event', name: '배우자출산휴가', nameEn: 'Spouse Childbirth Leave' },
  BEREAVEMENT:  { code: 'bereavement_parent',   category: 'family_event', name: '조의휴가', nameEn: 'Bereavement Leave' },
}

async function main() {
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  Phase 6: EmployeeLeaveBalance → LeaveYearBalance 마이그레이션`)
  console.log(`  Mode: ${DRY_RUN ? '🔍 DRY RUN (변경 없음)' : '⚡ LIVE'}`)
  console.log(`${'═'.repeat(60)}\n`)

  // ── 1단계: 누락 LeaveTypeDef 생성 ──────────────────────────
  console.log('📌 1단계: 누락된 LeaveTypeDef 확인 및 생성...')
  const companies = await prisma.company.findMany({
    where: { deletedAt: null },
    select: { id: true, code: true },
  })

  let typeDefsCreated = 0
  for (const company of companies) {
    for (const [leaveType, def] of Object.entries(LEAVE_TYPE_MAP)) {
      const existing = await prisma.leaveTypeDef.findFirst({
        where: {
          companyId: company.id,
          OR: [
            { code: def.code },
            { category: def.category, code: def.code },
          ],
        },
      })

      if (!existing) {
        // 이 회사에 해당 policy가 있는지 확인 (있을 때만 생성)
        const hasPolicy = await prisma.leavePolicy.findFirst({
          where: { companyId: company.id, leaveType: leaveType as never, isActive: true },
        })
        if (!hasPolicy) continue

        console.log(`  🆕 ${company.code}: ${def.code} (${def.nameEn}) 생성 필요`)
        if (!DRY_RUN) {
          await prisma.leaveTypeDef.create({
            data: {
              companyId: company.id,
              code: def.code,
              name: def.name,
              nameEn: def.nameEn,
              isPaid: true,
              allowHalfDay: true,
              requiresProof: false,
              isActive: true,
              displayOrder: 0,
              category: def.category,
              countingMethod: 'business_day',
            },
          })
        }
        typeDefsCreated++
      }
    }
  }
  console.log(`  ✅ LeaveTypeDef: ${typeDefsCreated}건 ${DRY_RUN ? '생성 예정' : '생성'}\n`)

  // ── 2단계: Balance 마이그레이션 ──────────────────────────────
  console.log('📌 2단계: EmployeeLeaveBalance → LeaveYearBalance 동기화...')

  const legacyBalances = await prisma.employeeLeaveBalance.findMany({
    include: {
      policy: { select: { leaveType: true, companyId: true } },
    },
  })

  let migrated = 0
  let skipped = 0
  let updated = 0
  const unmapped: string[] = []

  for (const bal of legacyBalances) {
    const def = LEAVE_TYPE_MAP[bal.policy.leaveType]
    if (!def) {
      unmapped.push(`${bal.employeeId}:${bal.policy.leaveType}`)
      skipped++
      continue
    }

    // LeaveTypeDef 찾기
    const typeDef = await prisma.leaveTypeDef.findFirst({
      where: {
        companyId: bal.policy.companyId,
        code: def.code,
        isActive: true,
      },
      select: { id: true },
    })

    if (!typeDef) {
      // 글로벌 fallback
      const globalTypeDef = await prisma.leaveTypeDef.findFirst({
        where: { companyId: null, code: def.code, isActive: true },
        select: { id: true },
      })
      if (!globalTypeDef) {
        unmapped.push(`${bal.employeeId}:${bal.policy.leaveType}:${bal.policy.companyId} (no TypeDef)`)
        skipped++
        continue
      }
    }

    const leaveTypeDefId = typeDef!.id

    // upsert: accrualEngine이 이미 생성한 레코드 존중
    const existing = await prisma.leaveYearBalance.findFirst({
      where: {
        employeeId: bal.employeeId,
        leaveTypeDefId,
        year: bal.year,
      },
    })

    if (existing) {
      // entitled/carriedOver는 accrualEngine 값 존중, used/pending만 동기화
      if (!DRY_RUN) {
        await prisma.leaveYearBalance.update({
          where: { id: existing.id },
          data: {
            used: Number(bal.usedDays),
            pending: Number(bal.pendingDays),
          },
        })
      }
      updated++
    } else {
      // 새 레코드 생성 (accrualEngine이 미실행된 경우)
      if (!DRY_RUN) {
        await prisma.leaveYearBalance.create({
          data: {
            employeeId: bal.employeeId,
            leaveTypeDefId,
            year: bal.year,
            entitled: Number(bal.grantedDays),
            used: Number(bal.usedDays),
            pending: Number(bal.pendingDays),
            carriedOver: Number(bal.carryOverDays),
            adjusted: 0,
          },
        })
      }
      migrated++
    }
  }

  console.log(`  ✅ Balance: ${migrated}건 생성, ${updated}건 업데이트, ${skipped}건 스킵`)
  if (unmapped.length > 0) {
    console.log(`  ⚠️ 매핑 불가 (${unmapped.length}건):`)
    unmapped.slice(0, 10).forEach(u => console.log(`    - ${u}`))
    if (unmapped.length > 10) console.log(`    ... 외 ${unmapped.length - 10}건`)
  }

  // ── 3단계: LeaveRequest.leaveTypeDefId 백필 ──────────────────
  console.log('\n📌 3단계: LeaveRequest.leaveTypeDefId null 백필...')

  const nullRequests = await prisma.leaveRequest.findMany({
    where: { leaveTypeDefId: null },
    include: {
      policy: { select: { leaveType: true, companyId: true } },
    },
  })

  let backfilled = 0
  let backfillSkipped = 0

  for (const req of nullRequests) {
    const def = LEAVE_TYPE_MAP[req.policy.leaveType]
    if (!def) { backfillSkipped++; continue }

    const typeDef = await prisma.leaveTypeDef.findFirst({
      where: { companyId: req.policy.companyId, code: def.code, isActive: true },
      select: { id: true },
    })

    if (!typeDef) { backfillSkipped++; continue }

    if (!DRY_RUN) {
      await prisma.leaveRequest.update({
        where: { id: req.id },
        data: { leaveTypeDefId: typeDef.id },
      })
    }
    backfilled++
  }

  console.log(`  ✅ LeaveRequest: ${backfilled}건 백필, ${backfillSkipped}건 스킵`)

  // ── 요약 ──────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`📊 마이그레이션 요약:`)
  console.log(`   LeaveTypeDef 생성: ${typeDefsCreated}건`)
  console.log(`   Balance 생성:      ${migrated}건`)
  console.log(`   Balance 업데이트:  ${updated}건`)
  console.log(`   Balance 스킵:      ${skipped}건`)
  console.log(`   Request 백필:      ${backfilled}건`)
  console.log(`${'─'.repeat(60)}\n`)

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('❌ 마이그레이션 실패:', e)
  await prisma.$disconnect()
  process.exit(1)
})
