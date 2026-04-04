// Off-Cycle Compensation: APPROVED Handler
// 요청자(initiator) + 대상 직원(employee)에게 승인 완료 알림

import type { DomainEventHandler, OffCycleCompApprovedPayload, TxClient } from '../types'
import { DOMAIN_EVENTS } from '../types'
import { sendNotification } from '@/lib/notifications'

export const offCycleApprovedHandler: DomainEventHandler<'OFF_CYCLE_COMP_APPROVED'> = {
  eventName: DOMAIN_EVENTS.OFF_CYCLE_COMP_APPROVED,

  async handle(payload: OffCycleCompApprovedPayload, _tx?: TxClient): Promise<void> {
    // 요청자(initiator)에게 알림
    sendNotification({
      employeeId: payload.initiatorId,
      triggerType: 'offCycleComp.approved',
      title: '비정기 급여 조정 승인 완료',
      body: '비정기 급여 조정 요청이 최종 승인되었습니다.',
      titleKey: 'notifications.offCycleComp.approved.title',
      bodyKey: 'notifications.offCycleComp.approved.body',
      link: `/compensation/off-cycle/${payload.requestId}`,
      priority: 'high',
      companyId: payload.companyId,
    })

    // 대상 직원에게 알림 (initiator와 동일인이 아닌 경우)
    if (payload.employeeId !== payload.initiatorId) {
      sendNotification({
        employeeId: payload.employeeId,
        triggerType: 'offCycleComp.approved',
        title: '급여 조정 안내',
        body: '급여 조정이 승인되었습니다. 상세 내용을 확인해 주세요.',
        titleKey: 'notifications.offCycleComp.approved.employee.title',
        bodyKey: 'notifications.offCycleComp.approved.employee.body',
        link: `/compensation/off-cycle/${payload.requestId}`,
        priority: 'normal',
        companyId: payload.companyId,
      })
    }
  },
}
