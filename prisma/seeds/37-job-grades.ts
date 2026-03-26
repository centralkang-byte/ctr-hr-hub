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

// Korean grade system — 실제 운영 기준: L1(매니저), L2(책임매니저), S(전문리더), E(경영리더)
// 기존 7단계 코드(G-*)는 마이그레이션 호환을 위해 유지하되, gradeType 추가
const KOREAN_GRADES = [
  { code: 'G-CHAIR', name: '회장',       nameEn: 'Chairman',       rankOrder: 0, gradeType: 'EXECUTIVE' },
  { code: 'G-ML',    name: '경영리더',   nameEn: 'Executive Leader', rankOrder: 1, gradeType: 'EXECUTIVE' },
  { code: 'G-EL',    name: '전문리더',   nameEn: 'Specialist Leader', rankOrder: 2, gradeType: 'SPECIALIST' },
  { code: 'G-SM',    name: '책임매니저', nameEn: 'Senior Manager',  rankOrder: 3, gradeType: 'STAFF' },
  { code: 'G-MGR',   name: '매니저',     nameEn: 'Manager',         rankOrder: 4, gradeType: 'STAFF' },
  { code: 'G-SE',    name: '책임연구원', nameEn: 'Senior Researcher', rankOrder: 5, gradeType: 'STAFF' },
  { code: 'G-ENG',   name: '연구원',     nameEn: 'Researcher',      rankOrder: 6, gradeType: 'STAFF' },
]

// Domestic Korean companies (use Korean grade system)
const DOMESTIC_COMPANIES = ['CTR-HOLD', 'CTR', 'CTR-MOB', 'CTR-ECO', 'CTR-ROB', 'CTR-ENR', 'CTR-FML']

// Overseas placeholder grades (per company) — L1~L5 기본 구조
const OVERSEAS_GRADES = [
  { codeSuffix: 'DIR', name: 'Director',     rankOrder: 1, gradeType: 'EXECUTIVE' as const },
  { codeSuffix: 'MGR', name: 'Manager',      rankOrder: 2, gradeType: 'STAFF' as const },
  { codeSuffix: 'SR',  name: 'Senior Staff', rankOrder: 3, gradeType: 'STAFF' as const },
  { codeSuffix: 'STF', name: 'Staff',        rankOrder: 4, gradeType: 'STAFF' as const },
  { codeSuffix: 'JR',  name: 'Junior Staff', rankOrder: 5, gradeType: 'STAFF' as const },
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
          data: { name: grade.name, nameEn: grade.nameEn, rankOrder: grade.rankOrder, gradeType: grade.gradeType },
        })
      } else {
        await prisma.jobGrade.create({
          data: { companyId, code: grade.code, name: grade.name, nameEn: grade.nameEn, rankOrder: grade.rankOrder, gradeType: grade.gradeType },
        })
      }
      total++
    }
    console.log(`  ✅ ${companyCode}: ${KOREAN_GRADES.length} Korean grades`)
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
          data: { name: grade.name, rankOrder: grade.rankOrder, gradeType: grade.gradeType },
        })
      } else {
        await prisma.jobGrade.create({
          data: { companyId, code, name: grade.name, rankOrder: grade.rankOrder, gradeType: grade.gradeType },
        })
      }
      total++
    }
    console.log(`  ✅ ${companyCode}: 5 overseas placeholder grades`)
  }

  // ── Korean Employee Titles (호칭) ──
  const KOREAN_TITLES = [
    { code: 'CHAIRMAN',  name: '회장',   nameEn: 'Chairman',        rankOrder: 1, isExecutive: true },
    { code: 'VICE_CHAIR', name: '부회장', nameEn: 'Vice Chairman',   rankOrder: 2, isExecutive: true },
    { code: 'CEO',       name: '대표이사', nameEn: 'CEO',            rankOrder: 3, isExecutive: true },
    { code: 'EVP',       name: '전무',   nameEn: 'EVP',              rankOrder: 4, isExecutive: true },
    { code: 'SVP',       name: '상무',   nameEn: 'SVP',              rankOrder: 5, isExecutive: true },
    { code: 'DIRECTOR',  name: '이사',   nameEn: 'Director',         rankOrder: 6, isExecutive: true },
    { code: 'GM',        name: '본부장', nameEn: 'General Manager',  rankOrder: 7, isExecutive: false },
    { code: 'DEPT_HEAD', name: '팀장',   nameEn: 'Department Head',  rankOrder: 8, isExecutive: false },
    { code: 'NONE',      name: '없음',   nameEn: 'None',             rankOrder: 99, isExecutive: false },
  ]

  let titleTotal = 0
  for (const companyCode of DOMESTIC_COMPANIES) {
    const companyId = companyMap[companyCode]
    if (!companyId) continue

    for (const title of KOREAN_TITLES) {
      const existing = await prisma.employeeTitle.findUnique({
        where: { companyId_code: { companyId, code: title.code } },
      })

      if (existing) {
        await prisma.employeeTitle.update({
          where: { id: existing.id },
          data: { name: title.name, nameEn: title.nameEn, rankOrder: title.rankOrder, isExecutive: title.isExecutive },
        })
      } else {
        await prisma.employeeTitle.create({
          data: { companyId, ...title },
        })
      }
      titleTotal++
    }
  }
  console.log(`  ✅ ${titleTotal} Korean titles seeded`)

  // ── Verification ──
  const dbCount = await prisma.jobGrade.count()
  const titleCount = await prisma.employeeTitle.count()
  console.log(`\n  ✅ ${total} job grades upserted (DB total: ${dbCount})`)
  console.log(`  ✅ ${titleTotal} titles upserted (DB total: ${titleCount})`)
}
