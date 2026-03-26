// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Probation Ending Nudge Rule
// src/lib/nudge/rules/probation-ending.rule.ts
// ═══════════════════════════════════════════════════════════
//
// 규정 참조: CP-G-02-01 인사관리규정 제18~19조
// 조건: Employee.probationEndDate가 14일 이내
// 대상: 직속 팀장 (Position.reportsToPositionId 기반)
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { addDays } from 'date-fns'
import type { NudgeRule, OverdueItem } from '../types'

export const probationEndingRule: NudgeRule = {
  ruleId:      'probation-ending',
  description: '수습기간 만료 예정 — 팀장에게 평가 알림',
  sourceModel: 'Employee',

  thresholds: {
    triggerAfterDays: 0,
    repeatEveryDays:  7,
    maxNudges:        3,
  },

  triggerType: 'nudge_probation_ending',

  buildTitle(): string {
    return '📋 수습 평가 필요'
  },

  buildBody(item: OverdueItem): string {
    const daysLeft = item.meta?.daysUntilEnd as number | undefined
    return `${item.displayTitle} — 수습기간 만료 ${daysLeft != null ? `${daysLeft}일 전` : '임박'}. 수습 평가서를 작성해 주세요.`
  },

  async findOverdueItems(
    companyId: string,
    assigneeId: string,
  ): Promise<OverdueItem[]> {
    const now = new Date()
    const lookAheadDate = addDays(now, 14)

    // 수습 중인 직원의 직속상관이 로그인 유저인 경우 조회
    // Raw SQL로 조인 쿼리 (Prisma relation 타입 이슈 회피)
    const rows = await prisma.$queryRaw<Array<{
      emp_id: string
      emp_name: string
      probation_end: Date
      manager_id: string
    }>>`
      SELECT
        e.id AS emp_id,
        e.name AS emp_name,
        e.probation_end_date AS probation_end,
        mgr_asg.employee_id AS manager_id
      FROM employees e
      JOIN employee_assignments ea ON ea.employee_id = e.id
        AND ea.is_primary = true AND ea.end_date IS NULL
        AND ea.company_id = ${companyId}
      JOIN positions p ON p.id = ea.position_id
      JOIN positions mgr_p ON mgr_p.id = p.reports_to_position_id
      JOIN employee_assignments mgr_asg ON mgr_asg.position_id = mgr_p.id
        AND mgr_asg.is_primary = true AND mgr_asg.end_date IS NULL
      WHERE e.probation_end_date >= ${now}
        AND e.probation_end_date <= ${lookAheadDate}
        AND e.probation_status = 'IN_PROGRESS'
        AND mgr_asg.employee_id = ${assigneeId}
      LIMIT 50
    `

    return rows.map((r) => {
      const daysUntilEnd = Math.ceil(
        (new Date(r.probation_end).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      )
      return {
        sourceId:     r.emp_id,
        sourceModel:  'Employee',
        recipientIds: [r.manager_id],
        createdAt:    addDays(new Date(r.probation_end), -14),
        displayTitle: `${r.emp_name} 수습 전환 평가`,
        actionUrl:    `/employees/${r.emp_id}`,
        meta: {
          employeeName: r.emp_name,
          probationEndDate: new Date(r.probation_end).toISOString().slice(0, 10),
          daysUntilEnd,
        },
      }
    })
  },
}
