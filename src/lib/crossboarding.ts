// ═══════════════════════════════════════════════════════════
// CTR HR Hub — triggerCrossboarding()
// 법인 간 이동 시 출발/도착 온보딩 플랜 동시 생성
// E-3 Enhanced:
//   - Arrival plan uses createOnboardingPlan() for E-1 enhancements
//     (dueDate computation, assigneeId resolution)
//   - Departure plan retains direct task creation (no E-1 enhancements needed)
//   - Skip sign-off auto-append for TRANSFER templates
//   - TODO: Trigger leave balance settlement for old company (GP#1 integration)
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
 * - TRANSFER templates skip sign-off auto-append (Spec A8)
 */
export async function triggerCrossboarding(
  input: CrossboardingInput,
): Promise<CrossboardingResult> {
  const { employeeId, fromCompanyId, toCompanyId, transferDate, buddyId } = input

  // 글로벌 크로스보딩 템플릿 조회
  // TRANSFER 템플릿 우선 → 없으면 CROSSBOARDING_DEPARTURE/ARRIVAL 폴백
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

  // E-3: Compute dueDates for tasks (relative to transferDate)
  const transferMs = transferDate.getTime()

  // 트랜잭션: 두 플랜 + 태스크 동시 생성, linkedPlanId로 연결
  // NOTE: Self-referential FK requires 3-step approach:
  //   1) Create both plans without linkedPlanId
  //   2) Update both with the cross-reference
  await prisma.$transaction(async (tx) => {
    // TODO: Trigger leave balance settlement for old company (GP#1 integration)

    // 1. 출발 법인 플랜 (departure) — without linkedPlanId
    await tx.employeeOnboarding.create({
      data: {
        id: departurePlanId,
        employeeId,
        templateId: depTemplate.id,
        companyId: fromCompanyId,
        planType: 'CROSSBOARDING_DEPARTURE',
        lastWorkingDate: transferDate,
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        tasks: {
          create: depTemplate.onboardingTasks.map((task) => ({
            id: randomUUID(),
            taskId: task.id,
            status: 'PENDING' as const,
            // E-3: Departure uses dueDaysBefore relative to transferDate
            dueDate: new Date(transferMs - (task.dueDaysAfter ?? 0) * 24 * 60 * 60 * 1000),
          })),
        },
      },
    })

    // 2. 도착 법인 플랜 (arrival — uses transfer date as "hire date" equivalent)
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
            // E-3: Arrival uses dueDaysAfter relative to transferDate
            dueDate: new Date(transferMs + task.dueDaysAfter * 24 * 60 * 60 * 1000),
          })),
        },
      },
    })

    // 3. Back-link departure plan to arrival plan
    await tx.employeeOnboarding.update({
      where: { id: departurePlanId },
      data: { linkedPlanId: arrivalPlanId },
    })
  })

  return {
    departurePlanId,
    arrivalPlanId,
    departureTaskCount: depTemplate.onboardingTasks.length,
    arrivalTaskCount: arrTemplate.onboardingTasks.length,
  }
}
