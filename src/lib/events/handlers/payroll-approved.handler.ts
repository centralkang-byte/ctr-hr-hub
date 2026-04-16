// ═══════════════════════════════════════════════════════════
// CTR HR Hub — PAYROLL_APPROVED Handler
// src/lib/events/handlers/payroll-approved.handler.ts
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// PROTECTED — DO NOT MODIFY without architecture review
// This file is a core infrastructure component. Changes here
// can break: triggers payslip generation and employee notification
// Last verified: 2026-03-12 (Q-4 P6)
// ═══════════════════════════════════════════════════════════════
//
// Side-effects on PAYROLL_APPROVED:
//   1. [TX] Payslip.createMany — 직원별 명세서 자동 생성
//   2. [ASYNC] sendNotifications('payslip_issued') — 배치 알림
//
// approve/route.ts L44-82의 hardcoded 로직을 핸들러로 추출.
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { sendNotifications } from '@/lib/notifications'
import type { DomainEventHandler, PayrollApprovedPayload, TxClient } from '../types'
import { DOMAIN_EVENTS } from '../types'

export const payrollApprovedHandler: DomainEventHandler<'PAYROLL_APPROVED'> = {
  eventName: DOMAIN_EVENTS.PAYROLL_APPROVED,

  async handle(payload: PayrollApprovedPayload, tx?: TxClient): Promise<void> {
    const db = tx ?? prisma

    // 1. [TX] Payslip 일괄 생성
    await db.payslip.createMany({
      data: payload.payrollItemIds.map((item) => ({
        payrollItemId: item.id,
        employeeId:    item.employeeId,
        companyId:     payload.ctx.companyId,
        year:          payload.year,
        month:         payload.month,
      })),
      skipDuplicates: true,
    })

    // 2. [ASYNC] 배치 알림 (fire-and-forget — tx 외부에서 실행)
    if (!tx) {
      void sendNotifications(
        payload.payrollItemIds.map((item) => ({
          employeeId:  item.employeeId,
          triggerType: 'payslip_issued',
          title:       '급여 명세서가 발급되었습니다',
          body:        `${payload.year}년 ${payload.month}월 급여 명세서를 확인하세요.`,
          titleKey:    'notifications.payslipIssued.title',
          bodyKey:     'notifications.payslipIssued.body',
          bodyParams:  { year: String(payload.year), month: String(payload.month) },
          link:        '/my/payroll/payslips',
          priority:    'normal' as const,
          metadata:    { year: payload.year, month: payload.month },
        })),
      )
    }
  },
}
