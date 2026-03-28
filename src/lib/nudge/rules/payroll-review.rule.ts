// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Payroll Review Nudge Rule
// src/lib/nudge/rules/payroll-review.rule.ts
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// PROTECTED — DO NOT MODIFY without architecture review
// This file is a core infrastructure component. Changes here
// can break: nudge rule — payroll review
// Last verified: 2026-03-12 (Q-4 P6)
// ═══════════════════════════════════════════════════════════════
//
// 조건: PayrollRun.status = 'REVIEW' AND updatedAt < cutoffDate
//       (REVIEW 진입 시각 기준 — updatedAt이 최선)
// 대상: PayrollRun.approvedById (담당 HR) — 미지정이면 PAYROLL 권한자
// 임계값: triggerAfterDays=1, repeatEveryDays=1, maxNudges=5
//          (급여는 지급일이 있어 더 촉박한 임계값 적용)
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import type { NudgeRule, OverdueItem } from '../types'

export const payrollReviewRule: NudgeRule = {
  ruleId:      'payroll-review-pending',
  description: '급여 검토 지연 — 담당자에게 리마인더',
  sourceModel: 'PayrollRun',

  thresholds: {
    triggerAfterDays: 1,   // REVIEW 상태 1일 이상 미처리
    repeatEveryDays:  1,   // 매일 반복
    maxNudges:        5,   // 최대 5회 (지급일 전까지)
  },

  triggerType: 'nudge_payroll_review',

  buildTitle(_item: OverdueItem): string {
    return '💰 급여 검토 대기 중'
  },

  buildBody(item: OverdueItem, daysOverdue: number): string {
    return `${item.displayTitle} — ${daysOverdue}일째 검토 대기 중입니다. 급여 처리를 진행해주세요.`
  },

  async findOverdueItems(
    companyId: string,
    assigneeId: string,
    cutoffDate: Date,
  ): Promise<OverdueItem[]> {
    // REVIEW 상태이고 updatedAt이 cutoffDate 이전인 급여 실행
    // (REVIEW 진입 후 그 상태가 유지된 시간 기준)
    const reviewRuns = await prisma.payrollRun.findMany({
      where: {
        companyId,
        status:    'REVIEW',
        updatedAt: { lt: cutoffDate },
        OR: [
          { approvedById: assigneeId },
          { approvedById: null },          // 미지정 — PAYROLL 권한자에게 fallback
        ],
      },
      select: {
        id:         true,
        yearMonth:  true,
        headcount:  true,
        totalNet:   true,
        currency:   true,
        updatedAt:  true,
        payDate:    true,
      },
      take: 20,
    })

    return reviewRuns.map((run) => {
      const totalNet = run.totalNet ? Number(run.totalNet).toLocaleString('ko-KR') : '미계산'
      return {
        sourceId:     run.id,
        sourceModel:  'PayrollRun',
        recipientIds: [assigneeId],
        createdAt:    run.updatedAt,    // REVIEW 진입 시각 근사치
        displayTitle: `${run.yearMonth} 급여 (${run.headcount}명 · ${totalNet} ${run.currency})`,
        actionUrl:    `/payroll/${run.id}/review`,
        meta: {
          yearMonth: run.yearMonth,
          headcount: run.headcount,
          totalNet:  run.totalNet ? Number(run.totalNet) : null,
          currency:  run.currency,
          payDate:   run.payDate?.toISOString().slice(0, 10) ?? null,
        },
      }
    })
  },
}
