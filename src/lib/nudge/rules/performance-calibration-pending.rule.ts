// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Performance Calibration Pending Nudge Rule
// src/lib/nudge/rules/performance-calibration-pending.rule.ts
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// PROTECTED — DO NOT MODIFY without architecture review
// This file is a core infrastructure component. Changes here
// can break: nudge rule — performance calibration pending
// Last verified: 2026-03-12 (Q-4 P6)
// ═══════════════════════════════════════════════════════════════
//
// 조건:
//   - PerformanceCycle.status = CALIBRATION
//   - CalibrationSession.status != CALIBRATION_COMPLETED
//   - 사이클이 CALIBRATION 페이즈로 전환된 지 3일 이상
//     (PerformanceCycle에 별도 timestamp 없음 → evalEnd를 기준 대리 사용)
//
// 대상:
//   - HR_ADMIN / SUPER_ADMIN 역할 직원
//   - 현재 코드베이스 패턴: employee.assignments active → 최대 10명
//   - CalibrationSession.createdBy → 세션 생성자에게도 직접 nudge
//
// 임계값:
//   - first: 3일 경과 후
//   - interval: 2일
//   - max: 5회
//
// triggerType: 'nudge:performance:calibration-pending'
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import type { NudgeRule, OverdueItem } from '../types'
// FIX: Issue #1 — Import shared HR_ADMIN lookup for calibration nudge recipients
import { getHrAndSuperAdminIds } from '@/lib/auth/hr-admin-lookup'

// ─── Rule ─────────────────────────────────────────────────

export const performanceCalibrationPendingRule: NudgeRule = {
  ruleId:      'performance-calibration-pending',
  description: 'CALIBRATION 페이즈 — 미완료 세션에 대해 HR에게 리마인더',
  sourceModel: 'CalibrationSession',

  thresholds: {
    triggerAfterDays: 3,
    repeatEveryDays:  2,
    maxNudges:        5,
  },

  triggerType: 'nudge:performance:calibration-pending',

  buildTitle(_item: OverdueItem): string {
    return '🗓️ 캘리브레이션 세션을 완료해 주세요'
  },

  buildBody(item: OverdueItem, daysOverdue: number): string {
    const sessionName = item.meta?.sessionName as string | undefined
    const cycleName   = item.meta?.cycleName as string | undefined
    return `${cycleName ?? '성과 주기'} — "${sessionName ?? '캘리브레이션 세션'}"이 ${daysOverdue}일째 진행 중입니다. 완료해 주세요.`
  },

  async findOverdueItems(
    companyId:  string,
    assigneeId: string,
    _cutoffDate: Date,
  ): Promise<OverdueItem[]> {
    const now = new Date()

    // ── 1. CALIBRATION 페이즈 사이클 확인 ───────────────
    const cycle = await prisma.performanceCycle.findFirst({
      where: { companyId, status: 'CALIBRATION' },
      select: {
        id:       true,
        name:     true,
        evalEnd:  true,  // CALIBRATION 진입 시점의 대리 타임스탬프로 활용
        createdAt: true,
      },
    })

    if (!cycle) return []

    // CALIBRATION 페이즈 진입 시점 추정:
    // evalEnd <= 현재 (이미 지났음) → evalEnd 기준으로 경과 일수 계산
    // evalEnd가 없거나 미래라면 → createdAt 기준 (fallback)
    const calibrationStartProxy = cycle.evalEnd && cycle.evalEnd <= now
      ? cycle.evalEnd
      : cycle.createdAt

    const daysSinceStart = Math.floor(
      (now.getTime() - calibrationStartProxy.getTime()) / 86_400_000,
    )

    // 3일 미만이면 아직 nudge 불필요
    if (daysSinceStart < 3) return []

    // ── 2. 미완료 CalibrationSession 조회 ───────────────
    const pendingSessions = await prisma.calibrationSession.findMany({
      where: {
        cycleId:   cycle.id,
        companyId,
        status:    { not: 'CALIBRATION_COMPLETED' },
      },
      select: {
        id:        true,
        name:      true,
        status:    true,
        createdBy: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    if (pendingSessions.length === 0) return []

    // FIX: Issue #1 — Check if assigneeId is an HR_ADMIN (via RBAC) OR session creator
    //   Previously: only session creator received this nudge (overly restrictive)
    //   Now: any active HR_ADMIN or SUPER_ADMIN in the company receives it // eslint-disable-line @typescript-eslint/no-explicit-any -- Prisma where clause dynamic type
    const hrAdminIds = await getHrAndSuperAdminIds(prisma, companyId)
    const isHrAdmin = hrAdminIds.includes(assigneeId)
    const isSessionCreator = pendingSessions.some((s) => s.createdBy === assigneeId)

    if (!isHrAdmin && !isSessionCreator) return []

    const items: OverdueItem[] = []

    for (const session of pendingSessions) {
      // 이 세션의 createdBy가 자신이 아니면 skip
      if (session.createdBy !== assigneeId) continue

      // 3일 후부터 trigger → session.createdAt + 3d 기준
      const triggerDate = new Date(
        session.createdAt.getTime() + 3 * 86_400_000,
      )
      if (now < triggerDate) continue

      items.push({
        sourceId:     session.id,
        sourceModel:  'CalibrationSession',
        recipientIds: [assigneeId],
        createdAt:    session.createdAt,
        displayTitle: `${session.name} — ${cycle.name}`,
        actionUrl:    '/performance/calibration',
        meta: {
          sessionId:   session.id,
          sessionName: session.name,
          sessionStatus: session.status,
          cycleName:   cycle.name,
          cycleId:     cycle.id,
          daysSinceStart,
        },
      })
    }

    return items
  },
}
