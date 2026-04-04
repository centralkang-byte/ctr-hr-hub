// Off-Cycle Compensation: REJECTED Handler
// 요청자(initiator)에게 반려 사유 포함 알림

import type { DomainEventHandler, OffCycleCompRejectedPayload, TxClient } from '../types'
import { DOMAIN_EVENTS } from '../types'
import { sendNotification } from '@/lib/notifications'

export const offCycleRejectedHandler: DomainEventHandler<'OFF_CYCLE_COMP_REJECTED'> = {
  eventName: DOMAIN_EVENTS.OFF_CYCLE_COMP_REJECTED,

  async handle(payload: OffCycleCompRejectedPayload, _tx?: TxClient): Promise<void> {
    const reason = payload.rejectionReason ?? '사유 없음'

    sendNotification({
      employeeId: payload.initiatorId,
      triggerType: 'offCycleComp.rejected',
      title: '비정기 급여 조정 반려',
      body: `비정기 급여 조정 요청이 반려되었습니다. 사유: ${reason}`,
      titleKey: 'notifications.offCycleComp.rejected.title',
      bodyKey: 'notifications.offCycleComp.rejected.body',
      bodyParams: {
        reason,
      },
      link: `/compensation/off-cycle/${payload.requestId}`,
      priority: 'high',
      companyId: payload.companyId,
    })
  },
}
