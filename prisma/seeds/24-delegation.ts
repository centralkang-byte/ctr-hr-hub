// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Delegation Seed Data
// prisma/seeds/24-delegation.ts
//
// F-2/F-3: Creates 3 delegation records + test leave data
//   1. Active delegation: Manager → Senior (current range)
//   2. Expired delegation: past date range
//   3. Future delegation: starts next week
// ═══════════════════════════════════════════════════════════

import { PrismaClient } from '../../src/generated/prisma/client'

export async function seedDelegation(prisma: PrismaClient) {
  console.log('  🔄 Seeding delegation data...')

  // Find managers — query through EmployeeRole → Role
  const managerRoles = await prisma.employeeRole.findMany({
    where: {
      role: { code: { in: ['MANAGER', 'HR_ADMIN'] } },
    },
    select: { employeeId: true },
    take: 10,
  })

  const managerIds = [...new Set(managerRoles.map((r) => r.employeeId))]

  const managers = await prisma.employee.findMany({
    where: {
      id: { in: managerIds },
      deletedAt: null,
    },
    include: {
      assignments: {
        where: { isPrimary: true, endDate: null },
        take: 1,
        select: { companyId: true },
      },
    },
    take: 5,
  })

  if (managers.length < 3) {
    console.log('    ⚠️ Not enough managers for delegation seed — skipping')
    return
  }

  const now = new Date()
  const companyId = (managers[0].assignments[0] as { companyId: string }).companyId

  // 1. Active delegation (today ~ 7 days from now)
  const activeStart = new Date(now)
  activeStart.setDate(activeStart.getDate() - 1) // started yesterday
  const activeEnd = new Date(now)
  activeEnd.setDate(activeEnd.getDate() + 7)

  await prisma.approvalDelegation.upsert({
    where: {
      id: 'seed-delegation-active',
    },
    update: {},
    create: {
      id: 'seed-delegation-active',
      delegatorId: managers[0].id,
      delegateeId: managers[1].id,
      companyId,
      scope: 'LEAVE_ONLY',
      startDate: activeStart,
      endDate: activeEnd,
      status: 'ACTIVE',
      reason: '시드 데이터: 활성 대결 (출장 중)',
    },
  })

  // 2. Expired delegation (2 weeks ago ~ 1 week ago)
  const expiredStart = new Date(now)
  expiredStart.setDate(expiredStart.getDate() - 14)
  const expiredEnd = new Date(now)
  expiredEnd.setDate(expiredEnd.getDate() - 7)

  await prisma.approvalDelegation.upsert({
    where: {
      id: 'seed-delegation-expired',
    },
    update: {},
    create: {
      id: 'seed-delegation-expired',
      delegatorId: managers[1].id,
      delegateeId: managers[2].id,
      companyId,
      scope: 'ALL',
      startDate: expiredStart,
      endDate: expiredEnd,
      status: 'EXPIRED',
      reason: '시드 데이터: 만료된 대결 (연수 참석)',
    },
  })

  // 3. Future delegation (starts next week ~ 2 weeks later)
  const futureStart = new Date(now)
  futureStart.setDate(futureStart.getDate() + 7)
  const futureEnd = new Date(now)
  futureEnd.setDate(futureEnd.getDate() + 21)

  await prisma.approvalDelegation.upsert({
    where: {
      id: 'seed-delegation-future',
    },
    update: {},
    create: {
      id: 'seed-delegation-future',
      delegatorId: managers[2].id,
      delegateeId: managers[0].id,
      companyId,
      scope: 'LEAVE_ONLY',
      startDate: futureStart,
      endDate: futureEnd,
      status: 'ACTIVE',
      reason: '시드 데이터: 예정된 대결 (해외 출장)',
    },
  })

  console.log('  ✅ Delegation seed: 3 records created (active, expired, future)')
}
