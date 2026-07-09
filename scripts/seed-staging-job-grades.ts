// ═══════════════════════════════════════════════════════════
// 일회성 staging 보정 — JobGrade / EmployeeTitle 시드 반영
// ───────────────────────────────────────────────────────────
// Session 222 F1(seedJobGrades 오케스트레이터 연결)은 시드 수정이라
// 코드 배포만으로는 staging 기존 DB의 직급 0개가 해소되지 않는다.
// 이 스크립트는 seedJobGrades 만 타깃 실행한다 (전체 prisma/seed.ts 금지).
//
// 동작 (⚠️ 단순 append 아님 — canonical 수렴):
//   - canonical 직급은 (companyId, code) findFirst 기반 upsert → idempotent.
//   - ⚠️ canonical 목록(국내 KOREAN_GRADES / 해외 OVERSEAS_GRADES) 밖의
//     기존 직급은 soft-delete(deletedAt) 처리된다. 하드 delete/FK 파괴는 없음.
//   - 실행 전 대상 DB 호스트 마스킹 출력 + soft-delete 대상 코드를 사전 고지.
//
// 사용법:
//   STAGING_DB_CONFIRM=1 DATABASE_URL='<staging>' \
//     npx tsx scripts/seed-staging-job-grades.ts
// ═══════════════════════════════════════════════════════════

import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import {
  seedJobGrades,
  KOREAN_GRADES,
  OVERSEAS_GRADES,
  DOMESTIC_COMPANIES,
} from '../prisma/seeds/37-job-grades'

function maskHost(url: string): string {
  try {
    const u = new URL(url)
    return `${u.protocol}//${u.username ? '***@' : ''}${u.hostname}:${u.port || '5432'}${u.pathname}`
  } catch {
    return '(파싱 불가 — URL 형식 확인 필요)'
  }
}

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL
  if (!DATABASE_URL) throw new Error('DATABASE_URL 필요')

  console.log('─'.repeat(60))
  console.log('대상 DB :', maskHost(DATABASE_URL))
  console.log('작업    : seedJobGrades (JobGrade + EmployeeTitle, 전 12법인)')
  console.log('성격    : idempotent upsert + ⚠️ canonical 밖 기존 직급 soft-delete (하드 delete 없음)')
  console.log('─'.repeat(60))

  const adapter = new PrismaPg({ connectionString: DATABASE_URL })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma: PrismaClient = new (PrismaClient as any)({ adapter, log: ['warn', 'error'] })

  try {
    // 사전 고지: soft-delete 대상(=canonical 밖 활성 직급) 미리 출력
    // canonical 목록은 37-job-grades.ts SSOT에서 직접 import (드리프트 방지)
    const DOMESTIC_CODES = KOREAN_GRADES.map(g => g.code)
    const OVERSEAS_CODES = OVERSEAS_GRADES.map(g => g.code)
    const companies = await prisma.company.findMany({ select: { id: true, code: true } })
    const willSoftDelete: string[] = []
    for (const c of companies) {
      const validCodes = DOMESTIC_COMPANIES.includes(c.code) ? DOMESTIC_CODES : OVERSEAS_CODES
      const orphans = await prisma.jobGrade.findMany({
        where: { companyId: c.id, code: { notIn: validCodes }, deletedAt: null },
        select: { code: true },
      })
      if (orphans.length > 0) willSoftDelete.push(`${c.code}: ${orphans.map(o => o.code).join(', ')}`)
    }
    if (willSoftDelete.length > 0) {
      console.log('⚠️ soft-delete 예정 (canonical 밖 활성 직급):')
      for (const line of willSoftDelete) console.log('   ', line)
    } else {
      console.log('soft-delete 대상 없음 (추가/upsert만 수행됨)')
    }
    console.log('─'.repeat(60))

    if (process.env.STAGING_DB_CONFIRM !== '1') {
      throw new Error(
        'SAFETY STOP: 공유 환경 쓰기(+위 soft-delete 포함). 대상 DB·soft-delete 목록 확인 후 STAGING_DB_CONFIRM=1 로 재실행.',
      )
    }

    const before = {
      grades: await prisma.jobGrade.count({ where: { deletedAt: null } }),
      titles: await prisma.employeeTitle.count({ where: { deletedAt: null } }),
    }
    console.log('실행 전(active) :', JSON.stringify(before))

    await seedJobGrades(prisma)

    const after = {
      grades: await prisma.jobGrade.count({ where: { deletedAt: null } }),
      titles: await prisma.employeeTitle.count({ where: { deletedAt: null } }),
    }
    console.log('실행 후(active) :', JSON.stringify(after))
    console.log(
      `delta   : grade ${after.grades - before.grades >= 0 ? '+' : ''}${after.grades - before.grades}, title ${after.titles - before.titles >= 0 ? '+' : ''}${after.titles - before.titles} (soft-delete 반영)`,
    )
    console.log('✅ 완료')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error('❌ 실패:', e)
  process.exit(1)
})
