// ================================================================
// Track B B-1c: JobGrade Seed — Korean 7-tier + Overseas Placeholder
// prisma/seeds/37-job-grades.ts
//
// Korean grades: 7 grades × 7 domestic companies = 49
//   (Schema requires companyId — can't be null. Created per domestic company.)
// Overseas grades: 5 grades × 5 overseas companies = 25
// Total: 74 grades
//
// ⚠️ APPEND/UPSERT only — never deleteMany (FK protection)
// No @@unique on [code, companyId], so uses findFirst + create/update pattern
// ================================================================

import { PrismaClient } from '../../src/generated/prisma/client'

// Korean 7-tier grade system
const KOREAN_GRADES = [
  { code: 'G-CHAIR', name: '회장', rankOrder: 0 },
  { code: 'G-ML', name: '경영리더', rankOrder: 1 },
  { code: 'G-EL', name: '전문리더', rankOrder: 2 },
  { code: 'G-SM', name: '책임매니저', rankOrder: 3 },
  { code: 'G-MGR', name: '매니저', rankOrder: 4 },
  { code: 'G-SE', name: '책임연구원', rankOrder: 5 },
  { code: 'G-ENG', name: '연구원', rankOrder: 6 },
]

// Domestic Korean companies (use Korean grade system)
const DOMESTIC_COMPANIES = ['CTR-HOLD', 'CTR', 'CTR-MOB', 'CTR-ECO', 'CTR-ROB', 'CTR-ENR', 'CTR-FML']

// Overseas placeholder grades (per company)
const OVERSEAS_GRADES = [
  { codeSuffix: 'DIR', name: 'Director', rankOrder: 1 },
  { codeSuffix: 'MGR', name: 'Manager', rankOrder: 2 },
  { codeSuffix: 'SR', name: 'Senior Staff', rankOrder: 3 },
  { codeSuffix: 'STF', name: 'Staff', rankOrder: 4 },
  { codeSuffix: 'JR', name: 'Junior Staff', rankOrder: 5 },
]

// Overseas companies
const OVERSEAS_COMPANIES = ['CTR-CN', 'CTR-US', 'CTR-VN', 'CTR-RU', 'CTR-EU']

// Company code → short suffix for overseas grade codes
const OVERSEAS_CODE_MAP: Record<string, string> = {
  'CTR-CN': 'CN',
  'CTR-US': 'US',
  'CTR-VN': 'VN',
  'CTR-RU': 'RU',
  'CTR-EU': 'EU',
}

// ================================================================
// Seed Function
// ================================================================
export async function seedJobGrades(prisma: PrismaClient): Promise<void> {
  console.log('\n📊 B-1c: Seeding job grades (7 Korean × 7 domestic + 5 overseas × 5)...\n')

  // ── Lookup companies ──
  const companies = await prisma.company.findMany({ select: { id: true, code: true } })
  const companyMap: Record<string, string> = {}
  for (const c of companies) companyMap[c.code] = c.id

  let total = 0

  // ── Korean grades for domestic companies ──
  for (const companyCode of DOMESTIC_COMPANIES) {
    const companyId = companyMap[companyCode]
    if (!companyId) {
      console.warn(`  ⚠️ Company "${companyCode}" not found — skipping`)
      continue
    }

    for (const grade of KOREAN_GRADES) {
      // Check if exists (no @@unique, use findFirst)
      const existing = await prisma.jobGrade.findFirst({
        where: { companyId, code: grade.code },
        select: { id: true },
      })

      if (existing) {
        await prisma.jobGrade.update({
          where: { id: existing.id },
          data: { name: grade.name, rankOrder: grade.rankOrder },
        })
      } else {
        await prisma.jobGrade.create({
          data: { companyId, code: grade.code, name: grade.name, rankOrder: grade.rankOrder },
        })
      }
      total++
    }
    console.log(`  ✅ ${companyCode}: 7 Korean grades`)
  }

  // ── Overseas placeholder grades ──
  for (const companyCode of OVERSEAS_COMPANIES) {
    const companyId = companyMap[companyCode]
    if (!companyId) {
      console.warn(`  ⚠️ Company "${companyCode}" not found — skipping`)
      continue
    }

    const coShort = OVERSEAS_CODE_MAP[companyCode]
    for (const grade of OVERSEAS_GRADES) {
      const code = `G-${coShort}-${grade.codeSuffix}`

      const existing = await prisma.jobGrade.findFirst({
        where: { companyId, code },
        select: { id: true },
      })

      if (existing) {
        await prisma.jobGrade.update({
          where: { id: existing.id },
          data: { name: grade.name, rankOrder: grade.rankOrder },
        })
      } else {
        await prisma.jobGrade.create({
          data: { companyId, code, name: grade.name, rankOrder: grade.rankOrder },
        })
      }
      total++
    }
    console.log(`  ✅ ${companyCode}: 5 overseas placeholder grades`)
  }

  // ── Verification ──
  const dbCount = await prisma.jobGrade.count()
  console.log(`\n  ✅ ${total} job grades upserted (DB total: ${dbCount})`)
}
