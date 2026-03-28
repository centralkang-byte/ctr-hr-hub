// ================================================================
// EmployeeTitle Seed Runner
// scripts/run-title-seed.ts
//
// Usage: npx tsx scripts/run-title-seed.ts
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

// ── Company lookup ──
async function main() {
  const companies = await prisma.company.findMany({ select: { id: true, code: true } })
  const companyMap: Record<string, string> = {}
  for (const c of companies) companyMap[c.code] = c.id

  console.log('Companies found:', Object.keys(companyMap).sort().join(', '))

  const DOMESTIC_COMPANIES = ['CTR-HQ', 'CTR-KR', 'CTR-MOB', 'CTR-ECO', 'CTR-ROB', 'CTR-ENG', 'FML']
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

  let total = 0
  for (const companyCode of DOMESTIC_COMPANIES) {
    const companyId = companyMap[companyCode]
    if (!companyId) {
      console.warn(`  ⚠️ "${companyCode}" not found — skipping`)
      continue
    }

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
      total++
    }
    console.log(`  ✅ ${companyCode}: ${KOREAN_TITLES.length} titles`)
  }

  const dbCount = await prisma.employeeTitle.count()
  console.log(`\n✅ ${total} titles upserted (DB total: ${dbCount})`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => { console.error('❌', e); prisma.$disconnect(); process.exit(1) })
