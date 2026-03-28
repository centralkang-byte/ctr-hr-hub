// ================================================================
// Grade↔Title Mapping Seed v2
// scripts/seed-grades-v2.ts
//
// Phase 4: 직급 코드 체계 재구축 (G1-G6 → L1/L2/E1/S1)
// Usage: npx tsx scripts/seed-grades-v2.ts
// ================================================================

import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })
dotenv.config({ path: path.resolve(__dirname, '..', '.env') })

import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Check .env.local or .env')
}

const adapter = new PrismaPg({ connectionString: DATABASE_URL })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma: PrismaClient = new (PrismaClient as any)({ adapter, log: ['warn', 'error'] })

// ── 한국 법인 Grade↔Title 매핑 정의 ──
interface GradeTitleDef {
  gradeCode: string
  gradeName: string
  gradeNameEn: string
  gradeType: 'STAFF' | 'EXECUTIVE' | 'SPECIALIST'
  rankOrder: number
  titleCode: string
  titleName: string
  titleNameEn: string
  isExecutive: boolean
}

const KR_GRADE_TITLE_MAP: GradeTitleDef[] = [
  {
    gradeCode: 'L1', gradeName: 'L1', gradeNameEn: 'L1',
    gradeType: 'STAFF', rankOrder: 1,
    titleCode: 'MANAGER', titleName: '매니저', titleNameEn: 'Manager',
    isExecutive: false,
  },
  {
    gradeCode: 'L2', gradeName: 'L2', gradeNameEn: 'L2',
    gradeType: 'STAFF', rankOrder: 2,
    titleCode: 'SR_MANAGER', titleName: '책임매니저', titleNameEn: 'Senior Manager',
    isExecutive: false,
  },
  {
    gradeCode: 'E1', gradeName: 'E1', gradeNameEn: 'E1',
    gradeType: 'EXECUTIVE', rankOrder: 3,
    titleCode: 'EXEC_LEADER', titleName: '경영리더', titleNameEn: 'Executive Leader',
    isExecutive: true,
  },
  {
    gradeCode: 'S1', gradeName: 'S1', gradeNameEn: 'S1',
    gradeType: 'SPECIALIST', rankOrder: 4,
    titleCode: 'SPEC_LEADER', titleName: '전문리더', titleNameEn: 'Specialist Leader',
    isExecutive: false,
  },
]

const DOMESTIC_COMPANIES = ['CTR-HQ', 'CTR-KR', 'CTR-MOB', 'CTR-ECO', 'CTR-ROB', 'CTR-ENG', 'FML']

async function main() {
  const companies = await prisma.company.findMany({ select: { id: true, code: true } })
  const companyMap: Record<string, string> = {}
  for (const c of companies) companyMap[c.code] = c.id

  console.log('Companies found:', Object.keys(companyMap).sort().join(', '))

  let totalGrades = 0
  let totalTitles = 0
  let totalMappings = 0

  for (const companyCode of DOMESTIC_COMPANIES) {
    const companyId = companyMap[companyCode]
    if (!companyId) {
      console.warn(`  ⚠️ "${companyCode}" not found — skipping`)
      continue
    }

    // 1) 기존 grade soft delete (assignment FK 보존)
    const oldGrades = await prisma.jobGrade.updateMany({
      where: { companyId, deletedAt: null },
      data: { deletedAt: new Date() },
    })
    console.log(`  🗑️  ${companyCode}: ${oldGrades.count} old grades soft-deleted`)

    // 2) 기존 title soft delete
    const oldTitles = await prisma.employeeTitle.updateMany({
      where: { companyId, deletedAt: null },
      data: { deletedAt: new Date() },
    })
    console.log(`  🗑️  ${companyCode}: ${oldTitles.count} old titles soft-deleted`)

    // 3) 기존 mapping 삭제 (hard delete — 새로 생성)
    const oldMappings = await prisma.gradeTitleMapping.deleteMany({
      where: { companyId },
    })
    if (oldMappings.count > 0) {
      console.log(`  🗑️  ${companyCode}: ${oldMappings.count} old mappings deleted`)
    }

    // 4) 새 Grade + Title + Mapping 생성
    for (const def of KR_GRADE_TITLE_MAP) {
      // Grade upsert (code 기준)
      const existingGrade = await prisma.jobGrade.findFirst({
        where: { companyId, code: def.gradeCode },
      })

      let gradeId: string
      if (existingGrade) {
        await prisma.jobGrade.update({
          where: { id: existingGrade.id },
          data: {
            name: def.gradeName,
            nameEn: def.gradeNameEn,
            gradeType: def.gradeType,
            rankOrder: def.rankOrder,
            deletedAt: null, // 복원
          },
        })
        gradeId = existingGrade.id
      } else {
        const grade = await prisma.jobGrade.create({
          data: {
            companyId,
            code: def.gradeCode,
            name: def.gradeName,
            nameEn: def.gradeNameEn,
            gradeType: def.gradeType,
            rankOrder: def.rankOrder,
          },
        })
        gradeId = grade.id
      }
      totalGrades++

      // Title upsert (companyId + code unique)
      const existingTitle = await prisma.employeeTitle.findUnique({
        where: { companyId_code: { companyId, code: def.titleCode } },
      })

      let titleId: string
      if (existingTitle) {
        await prisma.employeeTitle.update({
          where: { id: existingTitle.id },
          data: {
            name: def.titleName,
            nameEn: def.titleNameEn,
            rankOrder: def.rankOrder,
            isExecutive: def.isExecutive,
            deletedAt: null, // 복원
          },
        })
        titleId = existingTitle.id
      } else {
        const title = await prisma.employeeTitle.create({
          data: {
            companyId,
            code: def.titleCode,
            name: def.titleName,
            nameEn: def.titleNameEn,
            rankOrder: def.rankOrder,
            isExecutive: def.isExecutive,
          },
        })
        titleId = title.id
      }
      totalTitles++

      // Mapping 생성
      await prisma.gradeTitleMapping.create({
        data: { companyId, jobGradeId: gradeId, employeeTitleId: titleId },
      })
      totalMappings++
    }

    console.log(`  ✅ ${companyCode}: ${KR_GRADE_TITLE_MAP.length} grades/titles/mappings created`)
  }

  // 결과 요약
  const gradeCount = await prisma.jobGrade.count({ where: { deletedAt: null } })
  const titleCount = await prisma.employeeTitle.count({ where: { deletedAt: null } })
  const mappingCount = await prisma.gradeTitleMapping.count()

  console.log(`\n✅ Seed complete:`)
  console.log(`   Grades: ${totalGrades} upserted (DB active: ${gradeCount})`)
  console.log(`   Titles: ${totalTitles} upserted (DB active: ${titleCount})`)
  console.log(`   Mappings: ${totalMappings} created (DB total: ${mappingCount})`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => { console.error('❌', e); prisma.$disconnect(); process.exit(1) })
