// ═══════════════════════════════════════════════════════════
// CTR HR Hub — triggerCrossboarding()
// 법인 간 이동 시 출발/도착 온보딩 플랜 동시 생성
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'

export interface CrossboardingInput {
  employeeId: string
  fromCompanyId: string
  toCompanyId: string
  transferDate: Date
  buddyId?: string        // 도착 법인 버디 (선택)
  initiatedBy?: string   // 생성자 employeeId (감사 로그용)
}

export interface CrossboardingResult {
  departurePlanId: string
  arrivalPlanId: string
  departureTaskCount: number
  arrivalTaskCount: number
}

/**
 * 법인 간 이동(크로스보딩)을 트리거한다.
 * - 글로벌 CROSSBOARDING_DEPARTURE 템플릿 → 출발 법인 플랜 생성
 * - 글로벌 CROSSBOARDING_ARRIVAL 템플릿 → 도착 법인 플랜 생성
 * - 두 플랜은 linkedPlanId로 연결된다.
 */
export async function triggerCrossboarding(
  input: CrossboardingInput,
): Promise<CrossboardingResult> {
  const { employeeId, fromCompanyId, toCompanyId, transferDate, buddyId } = input

  // 글로벌 크로스보딩 템플릿 조회
  const [depTemplate, arrTemplate] = await Promise.all([
    prisma.onboardingTemplate.findFirst({
      where: { planType: 'CROSSBOARDING_DEPARTURE', companyId: null, isActive: true, deletedAt: null },
      include: { onboardingTasks: { orderBy: { sortOrder: 'asc' } } },
    }),
    prisma.onboardingTemplate.findFirst({
      where: { planType: 'CROSSBOARDING_ARRIVAL', companyId: null, isActive: true, deletedAt: null },
      include: { onboardingTasks: { orderBy: { sortOrder: 'asc' } } },
    }),
  ])

  if (!depTemplate) throw new Error('크로스보딩 출발 템플릿이 존재하지 않습니다.')
  if (!arrTemplate) throw new Error('크로스보딩 도착 템플릿이 존재하지 않습니다.')

  const departurePlanId = randomUUID()
  const arrivalPlanId = randomUUID()

  // 트랜잭션: 두 플랜 + 태스크 동시 생성, linkedPlanId로 연결
  await prisma.$transaction(async (tx) => {
    // 1. 출발 법인 플랜
    await tx.employeeOnboarding.create({
      data: {
        id: departurePlanId,
        employeeId,
        templateId: depTemplate.id,
        companyId: fromCompanyId,
        planType: 'CROSSBOARDING_DEPARTURE',
        linkedPlanId: arrivalPlanId,
        lastWorkingDate: transferDate,
        status: 'NOT_STARTED',
        tasks: {
          create: depTemplate.onboardingTasks.map((task) => ({
            id: randomUUID(),
            taskId: task.id,
            status: 'PENDING' as const,
          })),
        },
      },
    })

    // 2. 도착 법인 플랜
    await tx.employeeOnboarding.create({
      data: {
        id: arrivalPlanId,
        employeeId,
        templateId: arrTemplate.id,
        companyId: toCompanyId,
        buddyId: buddyId ?? null,
        planType: 'CROSSBOARDING_ARRIVAL',
        linkedPlanId: departurePlanId,
        startedAt: transferDate,
        status: 'NOT_STARTED',
        tasks: {
          create: arrTemplate.onboardingTasks.map((task) => ({
            id: randomUUID(),
            taskId: task.id,
            status: 'PENDING' as const,
          })),
        },
      },
    })
  })

  return {
    departurePlanId,
    arrivalPlanId,
    departureTaskCount: depTemplate.onboardingTasks.length,
    arrivalTaskCount: arrTemplate.onboardingTasks.length,
  }
}
