// Off-Cycle Compensation: SUBMITTED Handler
// 첫 번째 승인자에게 승인 요청 알림

import type { DomainEventHandler, OffCycleCompSubmittedPayload, TxClient } from '../types'
import { DOMAIN_EVENTS } from '../types'
import { sendNotification } from '@/lib/notifications'
import { prisma } from '@/lib/prisma'

export const offCycleSubmittedHandler: DomainEventHandler<'OFF_CYCLE_COMP_SUBMITTED'> = {
  eventName: DOMAIN_EVENTS.OFF_CYCLE_COMP_SUBMITTED,

  async handle(payload: OffCycleCompSubmittedPayload, _tx?: TxClient): Promise<void> {
    // firstApproverId가 명시된 경우 직접 사용, 아닌 경우 첫 단계 승인자 조회
    let approverId = payload.firstApproverId

    if (!approverId) {
      const firstStep = await prisma.offCycleApprovalStep.findFirst({
        where: { requestId: payload.requestId, stepNumber: 1 },
        select: { approverId: true, roleRequired: true },
      })

      if (firstStep?.approverId) {
        approverId = firstStep.approverId
      } else if (firstStep?.roleRequired) {
        // roleRequired 기반으로 해당 법인 HR_ADMIN 조회
        const hrAdmin = await prisma.employee.findFirst({
          where: {
            assignments: {
              some: {
                companyId: payload.companyId,
                endDate: null,
                isPrimary: true,
              },
            },
            employeeRoles: { some: { role: { code: firstStep.roleRequired }, endDate: null } },
            deletedAt: null,
            resignDate: null,
          },
          select: { id: true },
        })
        approverId = hrAdmin?.id
      }
    }

    if (!approverId) return

    sendNotification({
      employeeId: approverId,
      triggerType: 'offCycleComp.submitted',
      title: '비정기 급여 조정 승인 요청',
      body: '비정기 급여 조정 요청이 제출되었습니다. 승인을 검토해 주세요.',
      titleKey: 'notifications.offCycleComp.submitted.title',
      bodyKey: 'notifications.offCycleComp.submitted.body',
      link: `/compensation/off-cycle/${payload.requestId}`,
      priority: 'high',
      companyId: payload.companyId,
    })
  },
}
