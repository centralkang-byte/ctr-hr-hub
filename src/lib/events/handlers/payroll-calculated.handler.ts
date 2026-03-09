// ═══════════════════════════════════════════════════════════
// CTR HR Hub — PAYROLL_CALCULATED Handler
// src/lib/events/handlers/payroll-calculated.handler.ts
// ═══════════════════════════════════════════════════════════
//
// Side-effects on PAYROLL_CALCULATED:
//   현재 calculator.ts는 leave/attendance 데이터를 직접 read함 (cross-module).
//   이 핸들러는 향후 확장 포인트:
//   - Anomaly 알림 전송 (payroll_anomaly_detected)
//   - SocialInsuranceRecord 자동 생성 (향후 B7-3)
//   - AuditLog 기록
//
// 현재는 AuditLog stub만 구현.
// ═══════════════════════════════════════════════════════════

import { logAudit } from '@/lib/audit'
import type { DomainEventHandler, PayrollCalculatedPayload, TxClient } from '../types'
import { DOMAIN_EVENTS } from '../types'

export const payrollCalculatedHandler: DomainEventHandler<'PAYROLL_CALCULATED'> = {
  eventName: DOMAIN_EVENTS.PAYROLL_CALCULATED,

  async handle(payload: PayrollCalculatedPayload, _tx?: TxClient): Promise<void> {
    // Audit log (fire-and-forget — logAudit은 void)
    void logAudit({
      actorId:      payload.ctx.actorId,
      action:       'payroll.run.calculated',
      resourceType: 'PayrollRun',
      resourceId:   payload.runId,
      companyId:    payload.ctx.companyId,
      changes: {
        yearMonth:  payload.yearMonth,
        headcount:  payload.headcount,
        totalGross: payload.totalGross,
        totalNet:   payload.totalNet,
      },
    })
  },
}
