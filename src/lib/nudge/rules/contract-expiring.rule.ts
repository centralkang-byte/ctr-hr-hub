// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Contract Expiring Nudge Rule
// src/lib/nudge/rules/contract-expiring.rule.ts
// ═══════════════════════════════════════════════════════════
//
// 규정 참조: CP-G-02-01 인사관리규정 제15조
// 조건: 계약직 직원의 계약 만료가 30일 이내
// 대상: 직속 팀장 (Position.reportsToPositionId 기반)
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { addDays } from 'date-fns'
import type { NudgeRule, OverdueItem } from '../types'

export const contractExpiringRule: NudgeRule = {
  ruleId:      'contract-expiring',
  description: '계약 만료 예정 — 팀장에게 전환 평가 알림',
  sourceModel: 'EmployeeAssignment',

  thresholds: {
    triggerAfterDays: 0,
    repeatEveryDays:  7,
    maxNudges:        4,
  },

  triggerType: 'nudge_contract_expiring',

  buildTitle(): string {
    return '📄 계약 만료 평가 필요'
  },

  buildBody(item: OverdueItem): string {
    const daysLeft = item.meta?.daysUntilEnd as number | undefined
    return `${item.displayTitle} — 계약 만료 ${daysLeft != null ? `${daysLeft}일 전` : '임박'}. 전환/연장/종료 평가서를 작성해 주세요.`
  },

  async findOverdueItems(
    companyId: string,
    assigneeId: string,
  ): Promise<OverdueItem[]> {
    const now = new Date()
    const lookAheadDate = addDays(now, 30)

    const rows = await prisma.$queryRaw<Array<{
      asg_id: string
      emp_id: string
      emp_name: string
      end_date: Date
      manager_id: string
    }>>`
      SELECT
        ea.id AS asg_id,
        e.id AS emp_id,
        e.name AS emp_name,
        ea.end_date AS end_date,
        mgr_asg.employee_id AS manager_id
      FROM employee_assignments ea
      JOIN employees e ON e.id = ea.employee_id
      JOIN positions p ON p.id = ea.position_id
      JOIN positions mgr_p ON mgr_p.id = p.reports_to_position_id
      JOIN employee_assignments mgr_asg ON mgr_asg.position_id = mgr_p.id
        AND mgr_asg.is_primary = true AND mgr_asg.end_date IS NULL
      WHERE ea.company_id = ${companyId}
        AND ea.is_primary = true
        AND ea.employment_type = 'CONTRACT'
        AND ea.end_date >= ${now}
        AND ea.end_date <= ${lookAheadDate}
        AND mgr_asg.employee_id = ${assigneeId}
      LIMIT 50
    `

    return rows.map((r) => {
      const daysUntilEnd = Math.ceil(
        (new Date(r.end_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      )
      return {
        sourceId:     r.asg_id,
        sourceModel:  'EmployeeAssignment',
        recipientIds: [r.manager_id],
        createdAt:    addDays(new Date(r.end_date), -30),
        displayTitle: `${r.emp_name} 계약 만료 평가`,
        actionUrl:    `/employees/${r.emp_id}`,
        meta: {
          employeeName: r.emp_name,
          contractEndDate: new Date(r.end_date).toISOString().slice(0, 10),
          daysUntilEnd,
        },
      }
    })
  },
}
