// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Onboarding Plan Creation (Shared Function)
// src/lib/onboarding/create-onboarding-plan.ts
// ═══════════════════════════════════════════════════════════
//
// 재사용처:
//   - src/lib/events/handlers/employee-hired.handler.ts (자동)
//   - (향후) 수동 생성 API route에서도 호출 가능
//
// 참조 패턴: src/lib/crossboarding.ts
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'

export interface CreateOnboardingPlanInput {
  employeeId: string
  companyId: string
  hireDate: Date
  buddyId?: string
  /** 미지정 시 함수 내부에서 템플릿 자동 선택 */
  templateId?: string
}

export interface CreateOnboardingPlanResult {
  onboardingId: string
  templateId: string
  templateName: string
  taskCount: number
}

/**
 * 직원 온보딩 플랜을 생성한다.
 *
 * 템플릿 선택 우선순위:
 *   1. input.templateId 명시적 지정
 *   2. companyId 일치 + planType=ONBOARDING + isActive=true (회사 전용)
 *   3. companyId=null + planType=ONBOARDING + isActive=true (글로벌 기본)
 *   4. 없으면 null 반환 (온보딩 미생성 — 경고 로그)
 *
 * @param input  생성 파라미터
 * @param tx     선택적 Prisma 트랜잭션 클라이언트
 * @returns      생성 결과 or null (템플릿 없음)
 */
export async function createOnboardingPlan(
  input: CreateOnboardingPlanInput,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: any,
): Promise<CreateOnboardingPlanResult | null> {
  const db = tx ?? prisma

  // ── 템플릿 선택 ──────────────────────────────────────────

  let template: {
    id: string
    name: string
    onboardingTasks: Array<{ id: string }>
  } | null = null

  if (input.templateId) {
    // 명시적 지정
    template = await db.onboardingTemplate.findFirst({
      where: { id: input.templateId, isActive: true, deletedAt: null },
      include: { onboardingTasks: { orderBy: { sortOrder: 'asc' } } },
    })
  } else {
    // 자동 선택: 회사 전용 → 글로벌 순서
    template = await db.onboardingTemplate.findFirst({
      where: {
        planType: 'ONBOARDING',
        isActive: true,
        deletedAt: null,
        companyId: input.companyId,      // 회사 전용 우선
      },
      include: { onboardingTasks: { orderBy: { sortOrder: 'asc' } } },
    })

    if (!template) {
      // 글로벌 기본 템플릿 fallback
      template = await db.onboardingTemplate.findFirst({
        where: {
          planType: 'ONBOARDING',
          isActive: true,
          deletedAt: null,
          companyId: null,
        },
        include: { onboardingTasks: { orderBy: { sortOrder: 'asc' } } },
      })
    }
  }

  if (!template) {
    console.warn(
      `[createOnboardingPlan] No active ONBOARDING template found for company ${input.companyId}. ` +
      `Set up a company-specific or global template to enable auto-onboarding.`,
    )
    return null
  }

  // ── EmployeeOnboarding + tasks 생성 ─────────────────────

  const onboardingId = randomUUID()

  await db.employeeOnboarding.create({
    data: {
      id:         onboardingId,
      employeeId: input.employeeId,
      templateId: template.id,
      companyId:  input.companyId,
      buddyId:    input.buddyId ?? null,
      planType:   'ONBOARDING',
      status:     'NOT_STARTED',
      startedAt:  input.hireDate,    // 입사일 = 온보딩 시작일
      tasks: {
        create: template.onboardingTasks.map((task) => ({
          id:     randomUUID(),
          taskId: task.id,
          status: 'PENDING' as const,
        })),
      },
    },
  })

  return {
    onboardingId,
    templateId:   template.id,
    templateName: template.name,
    taskCount:    template.onboardingTasks.length,
  }
}
