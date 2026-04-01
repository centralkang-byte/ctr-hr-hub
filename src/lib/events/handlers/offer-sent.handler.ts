// Recruitment: OFFER_SENT Handler
// HR 담당자에게 오퍼 발송 알림

import type { DomainEventHandler, OfferSentPayload, TxClient } from '../types'
import { DOMAIN_EVENTS } from '../types'
import { sendNotification } from '@/lib/notifications'
import { prisma } from '@/lib/prisma'

export const offerSentHandler: DomainEventHandler<'OFFER_SENT'> = {
  eventName: DOMAIN_EVENTS.OFFER_SENT,

  async handle(payload: OfferSentPayload, _tx?: TxClient): Promise<void> {
    // Find HR admins in the company to notify
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
        triggerType: 'recruitment.offer_sent',
        title: '오퍼 발송',
        body: `${payload.applicantName}님에게 [${payload.postingTitle}] 오퍼가 발송되었습니다.`,
        titleKey: 'notifications.recruitment.offerSent.title',
        bodyKey: 'notifications.recruitment.offerSent.body',
        bodyParams: {
          applicantName: payload.applicantName,
          postingTitle: payload.postingTitle,
        },
        link: `/recruitment`,
        priority: 'normal',
        companyId: payload.companyId,
      })
    }
  },
}
