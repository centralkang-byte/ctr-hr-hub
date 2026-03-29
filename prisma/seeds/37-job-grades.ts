// ================================================================
// Track B B-1c: JobGrade Seed — Korean 4-tier (L1/L2/E1/S1)
// prisma/seeds/37-job-grades.ts
//
// Session 45 확정 체계:
//   한국 7 domestic: E1(경영리더), S1(전문리더), L2(책임매니저), L1(매니저)
//   해외: 미확정 — 세팅/마이그레이션 시 법인별 정의 예정
//
// ⚠️ APPEND/UPSERT only — never deleteMany (FK protection)
// ================================================================

import { PrismaClient } from '../../src/generated/prisma/client'

// Korean grade system — Session 45 확정: L1/L2/E1/S1 4단계
// 향후 L1~L5 + E2 + S2 확장 가능 (Settings에서 법인별 추가/삭제)
const KOREAN_GRADES = [
  { code: 'E1', name: '경영리더', nameEn: 'Executive Leader', rankOrder: 1, gradeType: 'EXECUTIVE', minPromotionYears: null },
  { code: 'S1', name: '전문리더', nameEn: 'Specialist Leader', rankOrder: 2, gradeType: 'SPECIALIST', minPromotionYears: null },
  { code: 'L2', name: '책임매니저', nameEn: 'Senior Manager', rankOrder: 3, gradeType: 'STAFF', minPromotionYears: 4 },
  { code: 'L1', name: '매니저', nameEn: 'Manager', rankOrder: 4, gradeType: 'STAFF', minPromotionYears: null },
]

// Domestic Korean companies
const DOMESTIC_COMPANIES = ['CTR-HOLD', 'CTR', 'CTR-MOB', 'CTR-ECO', 'CTR-ROB', 'CTR-ENR', 'CTR-FML']

// Korean Employee Titles (호칭) — Grade와 독립, Position(직위)과도 독립
const KOREAN_TITLES = [
  { code: 'CHAIRMAN',   name: '회장',     nameEn: 'Chairman',        rankOrder: 1, isExecutive: true },
  { code: 'VICE_CHAIR', name: '부회장',   nameEn: 'Vice Chairman',   rankOrder: 2, isExecutive: true },
  { code: 'CEO',        name: '대표이사', nameEn: 'CEO',             rankOrder: 3, isExecutive: true },
  { code: 'EVP',        name: '전무',     nameEn: 'EVP',             rankOrder: 4, isExecutive: true },
  { code: 'SVP',        name: '상무',     nameEn: 'SVP',             rankOrder: 5, isExecutive: true },
  { code: 'DIRECTOR',   name: '이사',     nameEn: 'Director',        rankOrder: 6, isExecutive: true },
  { code: 'GM',         name: '본부장',   nameEn: 'General Manager', rankOrder: 7, isExecutive: false },
  { code: 'DEPT_HEAD',  name: '팀장',     nameEn: 'Department Head', rankOrder: 8, isExecutive: false },
  { code: 'NONE',       name: '없음',     nameEn: 'None',            rankOrder: 99, isExecutive: false },
]

// ================================================================
// Seed Function
// ================================================================
export async function seedJobGrades(prisma: PrismaClient): Promise<void> {
  console.log('\n📊 B-1c: Seeding job grades (4 Korean × 7 domestic)...\n')

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
      const existing = await prisma.jobGrade.findFirst({
        where: { companyId, code: grade.code },
        select: { id: true },
      })

      if (existing) {
        await prisma.jobGrade.update({
          where: { id: existing.id },
          data: {
            name: grade.name, nameEn: grade.nameEn,
            rankOrder: grade.rankOrder, gradeType: grade.gradeType,
            minPromotionYears: grade.minPromotionYears,
          },
        })
      } else {
        await prisma.jobGrade.create({
          data: {
            companyId, code: grade.code, name: grade.name, nameEn: grade.nameEn,
            rankOrder: grade.rankOrder, gradeType: grade.gradeType,
            minPromotionYears: grade.minPromotionYears,
          },
        })
      }
      total++
    }
    console.log(`  ✅ ${companyCode}: ${KOREAN_GRADES.length} Korean grades (E1/S1/L2/L1)`)
  }

  // ── 해외 법인 grade는 미확정 — 세팅/마이그레이션 시 법인별 정의 예정 ──
  console.log('  ℹ️ Overseas grades: skipped (TBD per-entity)')

  // ── Korean Employee Titles (호칭) ──
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
  const dbCount = await prisma.jobGrade.count({ where: { deletedAt: null } })
  const titleCount = await prisma.employeeTitle.count({ where: { deletedAt: null } })
  console.log(`\n  ✅ ${total} job grades upserted (DB total: ${dbCount})`)
  console.log(`  ✅ ${titleTotal} titles upserted (DB total: ${titleCount})`)
}
