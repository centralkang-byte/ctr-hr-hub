// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Offboarding Started Event Handler
// src/lib/events/handlers/offboarding-started.handler.ts
// ═══════════════════════════════════════════════════════════
//
// EMPLOYEE_OFFBOARDING_STARTED 이벤트 수신 시:
//   1. 태스크 중복 생성 가드 (start/route.ts에서 이미 생성됨)
//   2. 미래 확장용: 추가 side-effect 연결 포인트
//
// 왜 핸들러가 필요한가?
//   - start/route.ts는 이미 트랜잭션 내에서 EmployeeOffboardingTask를 createMany
//   - 하지만 이벤트 스트림에 EMPLOYEE_OFFBOARDING_STARTED가 없으면
//     다른 모듈(알림, 분석)이 오프보딩 시작을 감지할 방법이 없음
//   - 이 핸들러는 fire-and-forget으로 실행되므로 메인 플로우에 영향 없음
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import type { DomainEventHandler, EmployeeOffboardingStartedPayload } from '../types'

export const offboardingStartedHandler: DomainEventHandler<'EMPLOYEE_OFFBOARDING_STARTED'> = {
  eventName: 'EMPLOYEE_OFFBOARDING_STARTED',

  async handle(payload: EmployeeOffboardingStartedPayload): Promise<void> {
    const { offboardingId, employeeId, companyId, checklistId } = payload

    try {
      // ── 중복 가드: start/route.ts에서 이미 태스크 생성됨 ────
      const existingTaskCount = await prisma.employeeOffboardingTask.count({
        where: { employeeOffboardingId: offboardingId },
      })

      if (existingTaskCount > 0) {
        // 정상 케이스: start/route.ts에서 이미 태스크 생성됨
        return
      }

      // ── Fallback: 태스크가 없는 경우 (이례적) — 체크리스트에서 생성 ──
      console.warn(
        `[offboarding-started.handler] No tasks found for offboarding ${offboardingId}. ` +
        `Attempting to create tasks from checklist ${checklistId}...`,
      )

      const tasks = await prisma.offboardingTask.findMany({
        where: { checklistId },
        orderBy: { sortOrder: 'asc' },
      })

      if (tasks.length === 0) {
        console.warn(
          `[offboarding-started.handler] No tasks found in checklist ${checklistId}. ` +
          `Offboarding ${offboardingId} will have no tasks.`,
        )
        return
      }

      await prisma.employeeOffboardingTask.createMany({
        data: tasks.map((task) => ({
          employeeOffboardingId: offboardingId,
          taskId:  task.id,
          status:  'PENDING' as const,
        })),
        skipDuplicates: true,
      })

      console.info(
        `[offboarding-started.handler] Created ${tasks.length} tasks for offboarding ` +
        `${offboardingId} (employee: ${employeeId}, company: ${companyId})`,
      )
    } catch (error) {
      // fire-and-forget: 에러를 throw하지 않음 — 메인 플로우에 영향 없음
      console.error(
        `[offboarding-started.handler] Error processing EMPLOYEE_OFFBOARDING_STARTED ` +
        `for offboarding ${offboardingId}:`,
        error,
      )
    }
  },
}
