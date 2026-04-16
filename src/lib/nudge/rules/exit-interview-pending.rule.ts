// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Exit Interview Pending Nudge Rule
// src/lib/nudge/rules/exit-interview-pending.rule.ts
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// PROTECTED — DO NOT MODIFY without architecture review
// This file is a core infrastructure component. Changes here
// can break: nudge rule — exit interview pending
// Last verified: 2026-03-12 (Q-4 P6)
// ═══════════════════════════════════════════════════════════════
//
// 조건: EmployeeOffboarding.status = IN_PROGRESS
//       AND lastWorkingDate <= now + 7일 (7일 이내 퇴직 예정)
//       AND ExitInterview 레코드가 존재하지 않음 (인터뷰 미완료)
//
// 대상:
//   - 현재 로그인 사용자가 해당 퇴직자의 HR 담당자인 경우 nudge
//   - NudgeEngine은 사용자별로 run하므로, 해당 사용자가
//     회사의 HR 담당이면 관련 오프보딩의 exit interview 진행 촉구
//
// 임계값:
//   - 최초 7일 전부터 경보 시작
//   - 1일 간격으로 반복
//   - 최대 7회 (마지막 근무일까지)
//
// Note: ExitInterview 모델에는 `scheduledAt`이 없음.
//       `interviewDate`는 실제 인터뷰가 완료된 날짜.
//       따라서 "pending" = ExitInterview 레코드가 아직 없는 상태.
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import type { NudgeRule, OverdueItem } from '../types'

// ─── 최종 근무일까지 남은 일수 기반 메시지 ────────────────────

function getUrgencyLabel(daysLeft: number): string {
  if (daysLeft <= 1) return '🚨 긴급'
  if (daysLeft <= 3) return '⚠️ 촉박'
  return '📋 예정'
}

// ─── Rule 구현 ────────────────────────────────────────────

export const exitInterviewPendingRule: NudgeRule = {
  ruleId:      'exit-interview-pending',
  description: '퇴직 인터뷰(Exit Interview) 미완료 — HR 담당자에게 리마인더',
  sourceModel: 'EmployeeOffboarding',

  thresholds: {
    triggerAfterDays: 0,    // 최종 근무일 7일 전부터 즉시
    repeatEveryDays:  1,    // 매일
    maxNudges:        7,    // 최종 근무일까지
  },

  triggerType: 'nudge:offboarding:exit-interview-pending',

  buildTitle(item: OverdueItem): string {
    const daysLeft = item.meta?.daysUntilLastWorking as number | undefined
    const urgency  = daysLeft !== undefined ? getUrgencyLabel(daysLeft) : '📋'
    return `${urgency} 퇴직 인터뷰 미완료`
  },

  buildBody(item: OverdueItem, _daysOverdue: number): string {
    const daysLeft = item.meta?.daysUntilLastWorking as number | undefined
    const deadline = daysLeft !== undefined
      ? ` (최종 근무일까지 ${daysLeft}일)`
      : ''
    return `${item.displayTitle}의 Exit Interview가 아직 진행되지 않았습니다${deadline}. 인터뷰를 예약해 주세요.`
  },

  getTitleKey(item: OverdueItem): string {
    const daysLeft = item.meta?.daysUntilLastWorking as number | undefined
    if (daysLeft !== undefined && daysLeft <= 1) return 'notifications.nudge.exitInterview.titleUrgent'
    if (daysLeft !== undefined && daysLeft <= 3) return 'notifications.nudge.exitInterview.titlePressing'
    return 'notifications.nudge.exitInterview.title'
  },
  getBodyKey(_item: OverdueItem): string {
    return 'notifications.nudge.exitInterview.body'
  },
  getBodyParams(item: OverdueItem): Record<string, string | number> {
    const daysLeft = item.meta?.daysUntilLastWorking != null ? Number(item.meta.daysUntilLastWorking) : 0
    return {
      displayTitle: item.displayTitle,
      employeeName: String(item.meta?.employeeName ?? ''),
      daysLeft,
    }
  },

  async findOverdueItems(
    companyId: string,
    assigneeId: string,  // 현재 로그인 사용자 (HR 담당자)
    _cutoffDate: Date,
  ): Promise<OverdueItem[]> {
    const now = new Date()

    // 7일 이내 퇴직 예정인 IN_PROGRESS 오프보딩 중 ExitInterview가 없는 것
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 86_400_000)

    // 진행 중인 오프보딩 중 lastWorkingDate가 7일 이내이고
    // ExitInterview 레코드가 없는 것을 조회
    const pendingOffboardings = await prisma.employeeOffboarding.findMany({
      where: {
        status:          'IN_PROGRESS',
        lastWorkingDate: { lte: sevenDaysFromNow },
        // ExitInterview가 없는 경우
        exitInterviews:  { none: {} },
        employee: {
          assignments: {
            some: {
              companyId,
              isPrimary: true,
              endDate:   null,
            },
          },
        },
      },
      select: {
        id:              true,
        employeeId:      true,
        lastWorkingDate: true,
        resignType:      true,
        startedAt:       true,
        employee: {
          select: {
            id:   true,
            name: true,
          },
        },
      },
      orderBy: { lastWorkingDate: 'asc' },
      take: 50,
    })

    if (pendingOffboardings.length === 0) return []

    // 수신자 판별: 현재 로그인 사용자가 HR 담당자인지 확인
    // NudgeEngine은 로그인 사용자별로 run하므로,
    // 해당 사용자가 회사의 HR/HR_ADMIN인지만 확인
    // (role 체크는 session에서 하지만 nudge context에서는 employeeId만 있음)
    // → 간단한 접근: HR/ADMIN 조건 없이 companyId + assigneeId로 매칭
    // → 실용적 접근: assigneeId가 동일 회사 직원이면 nudge 전달
    // 현재는 같은 회사 HR 팀원이면 누구나 수신 (HR 모듈 권한 체크는 API단에서 처리)

    // 수신자 확인: 현재 사용자가 해당 회사 직원인지 검증
    const senderCheck = await prisma.employeeAssignment.findFirst({
      where: {
        employeeId: assigneeId,
        companyId,
        isPrimary:  true,
        endDate:    null,
      },
      select: { employeeId: true },
    })

    if (!senderCheck) return []  // 해당 회사 직원이 아님

    const items: OverdueItem[] = []

    for (const offboarding of pendingOffboardings) {
      const lastWorkingDate    = offboarding.lastWorkingDate
      const daysUntilLastWorking = Math.ceil(
        (lastWorkingDate.getTime() - now.getTime()) / 86_400_000,
      )

      // 이미 최종 근무일이 지난 경우도 포함 (overdue)
      const daysOverdueOrRemaining = daysUntilLastWorking < 0
        ? Math.abs(daysUntilLastWorking)  // 지났으면 초과일
        : 0

      void daysOverdueOrRemaining  // 사용 안 함 — engine에서 계산

      items.push({
        sourceId:     offboarding.id,
        sourceModel:  'EmployeeOffboarding',
        recipientIds: [assigneeId],
        // engine의 daysOverdue 계산 기준: 7일 전 알림 시작점
        createdAt:    new Date(lastWorkingDate.getTime() - 7 * 86_400_000),
        displayTitle: offboarding.employee.name,
        actionUrl:    `/offboarding/${offboarding.id}/exit-interview`,
        meta: {
          employeeName:        offboarding.employee.name,
          employeeId:          offboarding.employeeId,
          offboardingId:       offboarding.id,
          lastWorkingDate:     lastWorkingDate.toISOString(),
          daysUntilLastWorking,
          resignType:          offboarding.resignType,
          noExitInterview:     true,
        },
      })
    }

    return items
  },
}
