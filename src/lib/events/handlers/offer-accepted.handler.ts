// Recruitment: OFFER_ACCEPTED Handler
// HR 담당자에게 오퍼 수락 알림

import type { DomainEventHandler, OfferAcceptedPayload, TxClient } from '../types'
import { DOMAIN_EVENTS } from '../types'
import { sendNotification } from '@/lib/notifications'
import { prisma } from '@/lib/prisma'

export const offerAcceptedHandler: DomainEventHandler<'OFFER_ACCEPTED'> = {
  eventName: DOMAIN_EVENTS.OFFER_ACCEPTED,

  async handle(payload: OfferAcceptedPayload, _tx?: TxClient): Promise<void> {
    const hrAdmins = await prisma.employee.findMany({
      where: {
        assignments: {
          some: {
            companyId: payload.companyId,
            endDate: null,
            isPrimary: true,
          },
        },
        user: { role: { in: ['HR_ADMIN', 'SUPER_ADMIN'] } },
        status: 'ACTIVE',
      },
      select: { id: true },
    })

    for (const hr of hrAdmins) {
      sendNotification({
        employeeId: hr.id,
        triggerType: 'recruitment.offer_accepted',
        title: '오퍼 수락',
        body: `${payload.applicantName}님이 [${payload.postingTitle}] 오퍼를 수락했습니다.`,
        titleKey: 'notifications.recruitment.offerAccepted.title',
        bodyKey: 'notifications.recruitment.offerAccepted.body',
        bodyParams: {
          applicantName: payload.applicantName,
          postingTitle: payload.postingTitle,
        },
        link: `/recruitment`,
        priority: 'high',
        companyId: payload.companyId,
      })
    }
  },
}
