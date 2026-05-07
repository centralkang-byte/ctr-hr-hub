/**
 * 52-department-heads.ts
 *
 * Department.headEmployeeId backfill (Session 201).
 *
 * 실행 시점: 모든 EmployeeAssignment 시드 이후. 49-edge-case-personas.ts
 * 끝부분에서 호출됨 (master seed.ts는 DO NOT TOUCH).
 *
 * 휴리스틱: 부서별 primary ACTIVE assignment 중,
 *   1) Position.reportsToPositionId === null (최상위 보고 종점), 또는
 *   2) Position.reportsTo.departmentId !== dept.id (외부 부서로 보고)
 * 인 employee를 부서장 후보로 선정. 결정론적 tie-break: employeeNo 오름차순.
 *
 * **Non-destructive**: `headEmployeeId` IS NULL인 부서만 업데이트. admin UI
 * 또는 다른 경로로 명시 지정된 head는 매 reseed에서 보존됨. 만약 휴리스틱을
 * 강제 재적용하려면 환경변수 `FORCE_DEPT_HEAD_BACKFILL=1`로 override.
 */

import type { PrismaClient } from '../../src/generated/prisma/client'

export async function seedDepartmentHeads(prisma: PrismaClient): Promise<void> {
  console.log('\n🌱 Seeding department heads (backfill)...')

  const force = process.env.FORCE_DEPT_HEAD_BACKFILL === '1'

  const departments = await prisma.department.findMany({
    where: {
      deletedAt: null,
      ...(force ? {} : { headEmployeeId: null }),
    },
    select: { id: true, companyId: true, code: true },
  })

  let assigned = 0
  let skipped = 0

  for (const dept of departments) {
    const candidates = await prisma.employeeAssignment.findMany({
      where: {
        departmentId: dept.id,
        companyId: dept.companyId,
        isPrimary: true,
        endDate: null,
        status: 'ACTIVE',
      },
      select: {
        employeeId: true,
        position: {
          select: {
            reportsToPositionId: true,
            reportsTo: { select: { departmentId: true } },
          },
        },
        employee: { select: { employeeNo: true } },
      },
    })

    const heads = candidates.filter((c) => {
      if (!c.position) return false
      // 최상위 — 부서 내 보고 체계 종점
      if (c.position.reportsToPositionId === null) return true
      // 외부 부서로 보고 (= 본부장/공장장 패턴: 자기 부서 소속이지만 외부 상위에 보고)
      return (
        c.position.reportsTo?.departmentId != null &&
        c.position.reportsTo.departmentId !== dept.id
      )
    })

    if (heads.length === 0) {
      skipped++
      continue
    }

    // 결정론적 tie-break: employeeNo 오름차순 첫 번째
    heads.sort((a, b) => a.employee.employeeNo.localeCompare(b.employee.employeeNo))

    // headEmployeeId IS NULL 가드 (force 미설정 시): findMany에서 이미 필터됐지만
    // race condition 대비 updateMany로 한 번 더 명시.
    const result = await prisma.department.updateMany({
      where: {
        id: dept.id,
        ...(force ? {} : { headEmployeeId: null }),
      },
      data: { headEmployeeId: heads[0].employeeId },
    })
    if (result.count > 0) assigned++
    else skipped++
  }

  console.log(
    `  ✅ Department heads: ${assigned} assigned, ${skipped} skipped (no candidate or already set${force ? ', force=1' : ''})`,
  )
}

// Standalone 실행: 마이그레이션 직후 prod/staging에서 backfill을 빠르게 적용.
//   npx tsx prisma/seeds/52-department-heads.ts
// 마이그레이션 자체에도 동일 휴리스틱의 SQL backfill이 포함되어 있어 신규
// 환경 첫 deploy 시 자동 실행됨. 이 standalone 모드는 마이그레이션이 이미
// 적용된 환경에서 재실행하거나 추가 조정 시 사용.
if (require.main === module) {
  void (async () => {
    // .env.local 자동 로드 (master seed.ts와 동일 패턴)
    const dotenv = await import('dotenv')
    const path = await import('path')
    dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env.local') })
    dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') })

    if (!process.env.DATABASE_URL) {
      console.error('❌ DATABASE_URL not set. Check .env.local exists and contains DATABASE_URL.')
      process.exit(1)
    }

    const { PrismaClient } = await import('../../src/generated/prisma/client')
    const { PrismaPg } = await import('@prisma/adapter-pg')
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
    const prisma = new (PrismaClient as unknown as new (
      args: { adapter: unknown },
    ) => InstanceType<typeof PrismaClient>)({ adapter })
    try {
      await seedDepartmentHeads(prisma)
    } finally {
      await prisma.$disconnect()
    }
  })()
}
