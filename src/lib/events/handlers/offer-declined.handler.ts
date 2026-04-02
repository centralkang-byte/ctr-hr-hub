// Recruitment: OFFER_DECLINED Handler
// HR 담당자에게 오퍼 거절 알림

import type { DomainEventHandler, OfferDeclinedPayload, TxClient } from '../types'
import { DOMAIN_EVENTS } from '../types'
import { sendNotification } from '@/lib/notifications'
import { prisma } from '@/lib/prisma'

export const offerDeclinedHandler: DomainEventHandler<'OFFER_DECLINED'> = {
  eventName: DOMAIN_EVENTS.OFFER_DECLINED,

  async handle(payload: OfferDeclinedPayload, _tx?: TxClient): Promise<void> {
    const hrAdmins = await prisma.employee.findMany({
      where: {
        assignments: {
          some: {
            companyId: payload.companyId,
            endDate: null,
            isPrimary: true,
          },
        },
        employeeRoles: { some: { role: { code: { in: ['HR_ADMIN', 'SUPER_ADMIN'] } }, endDate: null } },
        deletedAt: null,
        resignDate: null,
      },
      select: { id: true },
    })

    for (const hr of hrAdmins) {
      sendNotification({
        employeeId: hr.id,
        triggerType: 'recruitment.offer_declined',
        title: '오퍼 거절',
        body: `${payload.applicantName}님이 [${payload.postingTitle}] 오퍼를 거절했습니다.`,
        titleKey: 'notifications.recruitment.offerDeclined.title',
        bodyKey: 'notifications.recruitment.offerDeclined.body',
        bodyParams: {
          applicantName: payload.applicantName,
          postingTitle: payload.postingTitle,
          declineReason: payload.declineReason ?? '',
        },
        link: `/recruitment`,
        priority: 'high',
        companyId: payload.companyId,
      })
    }
  },
}
