// ═══════════════════════════════════════════════════════════
// CTR HR Hub — EMPLOYEE_HIRED Handler
// src/lib/events/handlers/employee-hired.handler.ts
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// PROTECTED — DO NOT MODIFY without architecture review
// This file is a core infrastructure component. Changes here
// can break: auto-creates OnboardingPlan when employee is hired
// Last verified: 2026-03-12 (Q-4 P6)
// ═══════════════════════════════════════════════════════════════
//
// 트리거: EMPLOYEE_HIRED 이벤트 (POST /api/v1/employees 직후 fire-and-forget)
//
// Side-effects:
//   1. [DB] EmployeeOnboarding + EmployeeOnboardingTask 자동 생성
//      - 회사 전용 ONBOARDING 템플릿 우선 / 글로벌 fallback
//      - 템플릿 없으면 warn + 종료 (직원 생성 롤백 없음)
//   2. [ASYNC] 매니저에게 온보딩 시작 알림 (향후 확장 포인트)
//
// 중요: fire-and-forget으로 발행되므로 이 핸들러의 실패는
//       직원 생성 트랜잭션에 영향을 주지 않는다.
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { createOnboardingPlan } from '@/lib/onboarding/create-onboarding-plan'
import type { DomainEventHandler, EmployeeHiredPayload, TxClient } from '../types'
import { DOMAIN_EVENTS } from '../types'

export const employeeHiredHandler: DomainEventHandler<'EMPLOYEE_HIRED'> = {
  eventName: DOMAIN_EVENTS.EMPLOYEE_HIRED,

  async handle(payload: EmployeeHiredPayload, tx?: TxClient): Promise<void> {
    // fire-and-forget에서 호출되므로 tx는 일반적으로 undefined.
    // tx가 전달된 경우에도 동일하게 동작 (통합 테스트 지원).
    const db = tx ?? prisma

    // 중복 방지: 이미 해당 direct 온보딩 플랜이 있으면 skip
    const existing = await db.employeeOnboarding.findFirst({
      where: {
        employeeId: payload.employeeId,
        planType:   'ONBOARDING',
      },
      select: { id: true },
    })

    if (existing) {
      console.info(
        `[employeeHiredHandler] EmployeeOnboarding already exists for employee ${payload.employeeId}. Skipping.`,
      )
      return
    }

    // 온보딩 플랜 생성 (shared function)
    const result = await createOnboardingPlan(
      {
        employeeId: payload.employeeId,
        companyId:  payload.companyId,
        hireDate:   payload.hireDate,
      },
      db,
    )

    if (!result) {
      // 템플릿 없음 — createOnboardingPlan 내부에서 이미 warn 로그
      return
    }

    console.info(
      `[employeeHiredHandler] Created onboarding plan ${result.onboardingId} ` +
      `(template: "${result.templateName}", tasks: ${result.taskCount}) ` +
      `for employee ${payload.employeeId}`,
    )
  },
}
