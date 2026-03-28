// ═══════════════════════════════════════════════════════════
// CTR HR Hub — F-3 Leave Enhancement Seed Data
// prisma/seeds/25-leave-enhancement.ts
//
// Creates test data for F-3 features:
//   - Negative balance test cases (within limit, at limit)
//   - Cancel scenario test data (APPROVED before/after start)
//   - PENDING leave aged 5+ days (nudge trigger)
//   - LeaveSetting with negative balance enabled
// ═══════════════════════════════════════════════════════════

import { PrismaClient } from '../../src/generated/prisma/client'

export async function seedLeaveEnhancement(prisma: PrismaClient) {
  console.log('  🔄 Seeding F-3 leave enhancement data...')

  // 1. Find a company and its employees
  const company = await prisma.company.findFirst({
    where: { deletedAt: null },
    select: { id: true },
  })
  if (!company) {
    console.log('    ⚠️ No company found — skipping')
    return
  }

  // 2. Enable negative balance for this company
  await prisma.leaveSetting.upsert({
    where: { companyId: company.id },
    update: {
      allowNegativeBalance: true,
      negativeBalanceLimit: -3.0,
    },
    create: {
      companyId: company.id,
      leaveTypes: '[]',
      annualLeaveRule: '{}',
      allowNegativeBalance: true,
      negativeBalanceLimit: -3.0,
    },
  })

  console.log('    ✅ LeaveSetting: negative balance enabled (limit: -3.0)')

  // 3. Find employees + leave policy for test data
  const employees = await prisma.employee.findMany({
    where: {
      deletedAt: null,
      assignments: {
        some: { companyId: company.id, isPrimary: true, endDate: null },
      },
    },
    select: { id: true, name: true },
    take: 6,
  })

  if (employees.length < 4) {
    console.log('    ⚠️ Not enough employees — skipping leave seed')
    return
  }

  const leavePolicy = await prisma.leavePolicy.findFirst({
    where: { companyId: company.id, deletedAt: null },
    select: { id: true },
  })

  if (!leavePolicy) {
    console.log('    ⚠️ No leave policy found — skipping')
    return
  }

  const now = new Date()
  const year = now.getFullYear()

  // 4. Create test balances with negative values (simulate overuse)
  // Employee 0: -1.5 days (within limit of -3.0)
  const balance0 = await prisma.employeeLeaveBalance.upsert({
    where: {
      employeeId_policyId_year: {
        employeeId: employees[0].id,
        policyId: leavePolicy.id,
        year,
      },
    },
    update: { grantedDays: 15, usedDays: 16.5 },
    create: {
      employeeId: employees[0].id,
      policyId: leavePolicy.id,
      year,
      grantedDays: 15,
      usedDays: 16.5, // -1.5 negative
      pendingDays: 0,
      carryOverDays: 0,
    },
  })

  // Employee 1: -3.0 days (at limit)
  const balance1 = await prisma.employeeLeaveBalance.upsert({
    where: {
      employeeId_policyId_year: {
        employeeId: employees[1].id,
        policyId: leavePolicy.id,
        year,
      },
    },
    update: { grantedDays: 15, usedDays: 18 },
    create: {
      employeeId: employees[1].id,
      policyId: leavePolicy.id,
      year,
      grantedDays: 15,
      usedDays: 18, // -3.0 negative (at limit)
      pendingDays: 0,
      carryOverDays: 0,
    },
  })

  console.log('    ✅ Negative balance test data: 2 employees')

  // 5. Create APPROVED leave starting tomorrow (cancel-before-start testable)
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const dayAfterTomorrow = new Date(tomorrow)
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1)

  await prisma.leaveRequest.upsert({
    where: { id: 'seed-leave-approved-future' },
    update: {},
    create: {
      id: 'seed-leave-approved-future',
      employeeId: employees[2].id,
      companyId: company.id,
      policyId: leavePolicy.id,
      startDate: tomorrow,
      endDate: dayAfterTomorrow,
      days: 2,
      reason: '시드: 시작 전 취소 테스트용 (APPROVED)',
      status: 'APPROVED',
      approvedById: employees[0].id,
      approvedAt: new Date(now.getTime() - 86400000),
    },
  })

  // 6. Create APPROVED leave that started 2 days ago (cancel-after-start, HR only)
  const twoDaysAgo = new Date(now)
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
  const twoDaysLater = new Date(now)
  twoDaysLater.setDate(twoDaysLater.getDate() + 2)

  await prisma.leaveRequest.upsert({
    where: { id: 'seed-leave-approved-started' },
    update: {},
    create: {
      id: 'seed-leave-approved-started',
      employeeId: employees[3].id,
      companyId: company.id,
      policyId: leavePolicy.id,
      startDate: twoDaysAgo,
      endDate: twoDaysLater,
      days: 4,
      reason: '시드: 시작 후 취소 테스트용 (APPROVED, HR만 가능)',
      status: 'APPROVED',
      approvedById: employees[0].id,
      approvedAt: new Date(now.getTime() - 86400000 * 3),
    },
  })

  console.log('    ✅ Cancel test data: 2 APPROVED requests (before/after start)')

  // 7. Create PENDING leave submitted 5 days ago (triggers nudge)
  const fiveDaysAgo = new Date(now)
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5)
  const nextWeek = new Date(now)
  nextWeek.setDate(nextWeek.getDate() + 7)

  await prisma.leaveRequest.upsert({
    where: { id: 'seed-leave-pending-aging' },
    update: {},
    create: {
      id: 'seed-leave-pending-aging',
      employeeId: employees[2].id,
      companyId: company.id,
      policyId: leavePolicy.id,
      startDate: nextWeek,
      endDate: new Date(nextWeek.getTime() + 86400000),
      days: 1,
      reason: '시드: 5일 대기 — 넛지 트리거 테스트',
      status: 'PENDING',
      createdAt: fiveDaysAgo,
    },
  })

  // 8. Create PENDING leave submitted today (no nudge yet)
  await prisma.leaveRequest.upsert({
    where: { id: 'seed-leave-pending-fresh' },
    update: {},
    create: {
      id: 'seed-leave-pending-fresh',
      employeeId: employees[3].id,
      companyId: company.id,
      policyId: leavePolicy.id,
      startDate: new Date(nextWeek.getTime() + 86400000 * 3),
      endDate: new Date(nextWeek.getTime() + 86400000 * 4),
      days: 1,
      reason: '시드: 당일 — 넛지 미발동',
      status: 'PENDING',
    },
  })

  console.log('    ✅ Pending test data: 2 requests (5-day-old + fresh)')
  console.log('  ✅ F-3 leave enhancement seed complete')
}
