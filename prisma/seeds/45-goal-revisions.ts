// ═══════════════════════════════════════════════════════════
// Seed: Goal Revisions (Phase C QA data)
// ═══════════════════════════════════════════════════════════
// APPROVED 목표에 대한 수정 제안 이력 시드
// 4건: APPROVED 2, REJECTED 1, PENDING 1

import type { PrismaClient } from '../../src/generated/prisma/client'

export async function seedGoalRevisions(prisma: PrismaClient) {
  console.log('  📝 Seeding Goal Revisions...')

  // CTR 법인 (한국 본사)에서 APPROVED 상태 목표 조회
  const approvedGoals = await prisma.mboGoal.findMany({
    where: {
      status: 'APPROVED',
      company: { code: 'CTR' },
    },
    include: {
      employee: { select: { id: true, name: true } },
      cycle: { select: { id: true } },
    },
    take: 4,
    orderBy: { createdAt: 'desc' },
  })

  if (approvedGoals.length < 2) {
    console.log('    ⚠️ APPROVED 목표 부족 — skip (최소 2개 필요)')
    return { created: 0, skipped: 0 }
  }

  // 매니저 찾기 (박준혁)
  const manager = await prisma.employee.findFirst({
    where: { email: 'manager@ctr.co.kr' },
    select: { id: true },
  })

  if (!manager) {
    console.log('    ⚠️ 매니저 계정 없음 — skip')
    return { created: 0, skipped: 0 }
  }

  const company = await prisma.company.findFirst({
    where: { code: 'CTR' },
    select: { id: true },
  })

  if (!company) {
    console.log('    ⚠️ CTR 법인 없음 — skip')
    return { created: 0, skipped: 0 }
  }

  let created = 0
  let skipped = 0

  // Revision 1: APPROVED (승인됨)
  if (approvedGoals[0]) {
    const goal = approvedGoals[0]
    const existing = await prisma.goalRevision.findFirst({
      where: { goalId: goal.id, version: 1 },
    })
    if (!existing) {
      await prisma.goalRevision.create({
        data: {
          goalId: goal.id,
          version: 1,
          prevTitle: goal.title,
          prevDescription: goal.description,
          prevWeight: goal.weight,
          prevTargetMetric: goal.targetMetric,
          prevTargetValue: goal.targetValue,
          newTitle: goal.title,
          newDescription: goal.description,
          newWeight: Number(goal.weight) + 10, // 가중치 10% 증가
          newTargetMetric: goal.targetMetric,
          newTargetValue: goal.targetValue,
          reason: '프로젝트 우선순위 변경으로 가중치 조정',
          status: 'APPROVED',
          proposedById: goal.employeeId,
          reviewedById: manager.id,
          reviewedAt: new Date('2026-03-15'),
          companyId: company.id,
        },
      })
      created++
    } else {
      skipped++
    }
  }

  // Revision 2: REJECTED (거부됨)
  if (approvedGoals[1]) {
    const goal = approvedGoals[1]
    const existing = await prisma.goalRevision.findFirst({
      where: { goalId: goal.id, version: 1 },
    })
    if (!existing) {
      await prisma.goalRevision.create({
        data: {
          goalId: goal.id,
          version: 1,
          prevTitle: goal.title,
          prevDescription: goal.description,
          prevWeight: goal.weight,
          prevTargetMetric: goal.targetMetric,
          prevTargetValue: goal.targetValue,
          newTitle: `${goal.title} (수정)`,
          newDescription: '목표 범위 축소 제안',
          newWeight: Number(goal.weight) - 5,
          newTargetMetric: goal.targetMetric,
          newTargetValue: goal.targetValue,
          reason: '팀 리소스 부족으로 범위 조정 요청',
          status: 'REJECTED',
          proposedById: goal.employeeId,
          reviewedById: manager.id,
          reviewComment: '현재 가중치를 유지해주세요. 리소스는 별도 조정하겠습니다.',
          reviewedAt: new Date('2026-03-20'),
          companyId: company.id,
        },
      })
      created++
    } else {
      skipped++
    }
  }

  // Revision 3: PENDING (승인 대기)
  if (approvedGoals.length >= 3 && approvedGoals[2]) {
    const goal = approvedGoals[2]
    const existing = await prisma.goalRevision.findFirst({
      where: { goalId: goal.id, version: 1 },
    })
    if (!existing) {
      await prisma.goalRevision.create({
        data: {
          goalId: goal.id,
          version: 1,
          prevTitle: goal.title,
          prevDescription: goal.description,
          prevWeight: goal.weight,
          prevTargetMetric: goal.targetMetric,
          prevTargetValue: goal.targetValue,
          newTitle: goal.title,
          newDescription: goal.description,
          newWeight: goal.weight,
          newTargetMetric: '분기 매출액',
          newTargetValue: '15억',
          reason: 'Q2 사업계획 확정에 따른 목표 지표 변경',
          status: 'PENDING',
          proposedById: goal.employeeId,
          companyId: company.id,
        },
      })
      created++
    } else {
      skipped++
    }
  }

  // Revision 4: APPROVED v2 (같은 목표의 2차 수정)
  if (approvedGoals[0]) {
    const goal = approvedGoals[0]
    const existing = await prisma.goalRevision.findFirst({
      where: { goalId: goal.id, version: 2 },
    })
    if (!existing) {
      await prisma.goalRevision.create({
        data: {
          goalId: goal.id,
          version: 2,
          prevTitle: goal.title,
          prevDescription: goal.description,
          prevWeight: Number(goal.weight) + 10,
          prevTargetMetric: goal.targetMetric,
          prevTargetValue: goal.targetValue,
          newTitle: goal.title,
          newDescription: goal.description,
          newWeight: Number(goal.weight) + 5, // 추가 조정
          newTargetMetric: goal.targetMetric,
          newTargetValue: '20억 달성',
          reason: '목표 값 상향 조정 (CEO 지시)',
          status: 'APPROVED',
          proposedById: goal.employeeId,
          reviewedById: manager.id,
          reviewedAt: new Date('2026-03-25'),
          companyId: company.id,
        },
      })
      created++
    } else {
      skipped++
    }
  }

  console.log(`    ✅ Goal Revisions: ${created} created, ${skipped} skipped`)
  return { created, skipped }
}
