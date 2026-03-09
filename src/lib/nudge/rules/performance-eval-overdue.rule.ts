// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Performance Evaluation Overdue Nudge Rule
// src/lib/nudge/rules/performance-eval-overdue.rule.ts
// ═══════════════════════════════════════════════════════════
//
// EVAL_OPEN 페이즈에서 두 가지 시나리오를 한 룰에서 처리:
//
// A) 자기평가 미제출 (Self-eval)
//    - 로그인 사용자에게 evalType=SELF, status in [SUBMITTED,CONFIRMED] 없음
//    - → 본인에게 nudge
//
// B) 팀원 평가 미입력 (Manager-eval)
//    - 로그인 사용자가 매니저인 경우
//    - 직속 팀원 중 evalType=MANAGER 평가가 없는 경우
//    - → 해당 매니저(로그인 사용자)에게 nudge (per 팀원)
//
// evalEnd 기준 임계값:
//   D-5 이전   →  trigger 없음
//   D-5 이하   →  trigger=0, interval=2d, max=2
//   D-2 이하   →  trigger=0, interval=1d, max=3
//   초과        →  trigger=0, interval=1d, max=5
//   초과 3d+   →  HR_ADMIN에게도 보조 nudge (1회)
//
// triggerType: 'nudge:performance:eval-overdue'
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { sendNotification } from '@/lib/notifications'
import type { NudgeRule, NudgeThresholds, OverdueItem } from '../types'

// ─── 임계값 ───────────────────────────────────────────────

function getEvalThresholds(daysUntilDeadline: number): NudgeThresholds | null {
  if (daysUntilDeadline > 5) return null   // 아직 nudge 불필요
  if (daysUntilDeadline <= 0) {
    // evalEnd 초과: 즉시, 매일, 최대 5회
    return { triggerAfterDays: 0, repeatEveryDays: 1, maxNudges: 5 }
  }
  if (daysUntilDeadline <= 2) {
    // D-2 이하: trigger=0, 1일 간격, 최대 3회
    return { triggerAfterDays: 0, repeatEveryDays: 1, maxNudges: 3 }
  }
  // D-5~D-3: trigger=0, 2일 간격, 최대 2회
  return { triggerAfterDays: 0, repeatEveryDays: 2, maxNudges: 2 }
}

// ─── Rule ─────────────────────────────────────────────────

export const performanceEvalOverdueRule: NudgeRule = {
  ruleId:      'performance-eval-overdue',
  description: 'EVAL_OPEN 페이즈 — 자기평가/팀원평가 미완료 시 리마인더',
  sourceModel: 'PerformanceCycle',

  thresholds: {
    triggerAfterDays: 0,
    repeatEveryDays:  1,
    maxNudges:        5,
  },

  triggerType: 'nudge:performance:eval-overdue',

  buildTitle(item: OverdueItem): string {
    const subType = item.meta?.subType as string | undefined
    if (subType === 'mgr-eval') return '👥 팀원 평가를 작성해 주세요'
    return '📝 자기평가를 제출해 주세요'
  },

  buildBody(item: OverdueItem, daysOverdue: number): string {
    const cycleName = item.meta?.cycleName as string | undefined
    const subType   = item.meta?.subType as string | undefined
    const targetName = item.meta?.targetEmployeeName as string | undefined
    const daysLeft  = item.meta?.daysUntilDeadline as number | undefined

    const suffix = daysLeft !== undefined && daysLeft > 0
      ? `마감이 ${daysLeft}일 남았습니다.`
      : `기한이 ${Math.abs(daysOverdue)}일 초과됐습니다.`

    if (subType === 'mgr-eval' && targetName) {
      return `${cycleName ?? '성과 주기'} — ${targetName}님 매니저 평가 ${suffix}`
    }
    return `${cycleName ?? '성과 주기'} 자기평가를 아직 제출하지 않았습니다. ${suffix}`
  },

  async findOverdueItems(
    companyId:   string,
    assigneeId:  string,
    _cutoffDate: Date,
  ): Promise<OverdueItem[]> {
    const now = new Date()

    // ── 1. EVAL_OPEN 사이클 조회 ─────────────────────────
    const cycle = await prisma.performanceCycle.findFirst({
      where: { companyId, status: 'EVAL_OPEN' },
    })

    if (!cycle?.evalEnd) return []

    const evalEnd            = cycle.evalEnd
    const daysUntilDeadline  = Math.ceil(
      (evalEnd.getTime() - now.getTime()) / 86_400_000,
    )

    // D-5보다 더 남은 경우 → nudge 불필요
    const thresholds = getEvalThresholds(daysUntilDeadline)
    if (!thresholds) return []

    const daysOverdue = Math.max(0, -daysUntilDeadline)

    // ── 2. 배치 조회: 사이클 내 모든 평가 현황 ──────────
    // 이 찾는 사람이 관련된 평가만 필터 (self + mgr)
    const allEvals = await prisma.performanceEvaluation.findMany({
      where: {
        cycleId:   cycle.id,
        companyId,
        OR: [
          // 본인 자기평가
          { employeeId: assigneeId, evalType: 'SELF' },
          // 본인이 평가자인 매니저 평가
          { evaluatorId: assigneeId, evalType: 'MANAGER' },
        ],
      },
      select: {
        employeeId:  true,
        evaluatorId: true,
        evalType:    true,
        status:      true,
      },
    })

    // 자기평가 완료 여부
    const selfEvalDone = allEvals.some(
      (e) => e.evalType === 'SELF' &&
             e.employeeId === assigneeId &&
             (e.status === 'SUBMITTED' || e.status === 'CONFIRMED'),
    )

    // 매니저 평가: 내가 평가자인 경우 완료된 대상 집합
    const mgrEvalDoneSet = new Set(
      allEvals
        .filter(
          (e) => e.evalType === 'MANAGER' &&
                 e.evaluatorId === assigneeId &&
                 (e.status === 'SUBMITTED' || e.status === 'CONFIRMED'),
        )
        .map((e) => e.employeeId),
    )

    const items: OverdueItem[] = []
    const createdAt = daysUntilDeadline <= 0
      ? evalEnd
      : new Date(evalEnd.getTime() - 5 * 86_400_000)

    // ── 3. 시나리오 A: 자기평가 미제출 ──────────────────
    if (!selfEvalDone) {
      items.push({
        sourceId:     `self-eval:${assigneeId}:${cycle.id}`,
        sourceModel:  'PerformanceCycle',
        recipientIds: [assigneeId],
        createdAt,
        displayTitle: `${cycle.name} 자기평가 미제출`,
        actionUrl:    '/performance/self-eval',
        meta: {
          subType:          'self-eval',
          cycleName:        cycle.name,
          cycleId:          cycle.id,
          evalEnd:          evalEnd.toISOString(),
          daysUntilDeadline,
          daysOverdue,
          thresholds,
        },
      })
    }

    // ── 4. 시나리오 B: 매니저 평가 미입력 ───────────────
    // 내가 매니저인 경우: 직속 팀원 중 평가 안 한 사람 찾기
    // 로그인 사용자의 포지션 조회 (배치 효율 위해 직접 쿼리)
    const myAssignment = await prisma.employeeAssignment.findFirst({
      where:  { employeeId: assigneeId, isPrimary: true, endDate: null },
      select: { positionId: true },
    })

    if (myAssignment?.positionId) {
      // 직속 팀원 조회 (포지션 기반)
      const directReports = await prisma.employeeAssignment.findMany({
        where: {
          companyId,
          isPrimary: true,
          endDate:   null,
          status:    'ACTIVE',
          position:  { reportsToPositionId: myAssignment.positionId },
        },
        select: {
          employeeId: true,
          employee:   { select: { name: true } },
        },
      })

      for (const report of directReports) {
        const reportId = report.employee ? report.employeeId : null
        if (!reportId) continue

        // 이미 완료한 팀원 → skip
        if (mgrEvalDoneSet.has(reportId)) continue

        items.push({
          sourceId:     `mgr-eval:${assigneeId}:${reportId}:${cycle.id}`,
          sourceModel:  'PerformanceCycle',
          recipientIds: [assigneeId],
          createdAt,
          displayTitle: `${cycle.name} — ${report.employee?.name}님 매니저 평가 미완료`,
          actionUrl:    `/performance/team-evaluations?employeeId=${reportId}&cycleId=${cycle.id}`,
          meta: {
            subType:            'mgr-eval',
            cycleName:          cycle.name,
            cycleId:            cycle.id,
            evalEnd:            evalEnd.toISOString(),
            daysUntilDeadline,
            daysOverdue,
            thresholds,
            targetEmployeeId:   reportId,
            targetEmployeeName: report.employee?.name,
          },
        })
      }
    }

    // ── 5. 보조 nudge: evalEnd 초과 3일+ → HR에게 1회 ──
    if (daysOverdue >= 3) {
      try {
        // HR 관련 알림은 companyId 기반으로 cycle 단위 1회만
        // (이미 Notification 테이블 triggerType으로 dedup됨)
        const hrEmployees = await prisma.employee.findMany({
          where: {
            assignments: {
              some: {
                companyId,
                isPrimary: true,
                endDate:   null,
                status:    'ACTIVE',
              },
            },
          },
          select: { id: true },
          take:   10,
        })

        for (const hr of hrEmployees) {
          void sendNotification({
            employeeId:  hr.id,
            triggerType: `nudge:performance:eval-overdue:hr:${cycle.id}`,
            title:       `⚠️ 평가 기간 초과 — HR 확인 필요`,
            body:        `${cycle.name} 평가 기간이 ${daysOverdue}일 초과됐습니다. 독려가 필요합니다.`,
            link:        '/performance/evaluations/manager',
            priority:    'high',
            companyId,
            metadata:    { cycleId: cycle.id, daysOverdue },
          })
        }
      } catch (err) {
        console.warn('[performanceEvalOverdueRule] HR nudge failed:', err)
      }
    }

    return items
  },
}
