// Compensation: COMP_APPROVED Handler
// HR 담당자에게 "보상 승인 완료 → 통보서 생성" 알림

import type { DomainEventHandler, CompApprovedPayload, TxClient } from '../types'
import { DOMAIN_EVENTS } from '../types'
import { sendNotification } from '@/lib/notifications'
import { prisma } from '@/lib/prisma'

export const compApprovedHandler: DomainEventHandler<'COMP_APPROVED'> = {
  eventName: DOMAIN_EVENTS.COMP_APPROVED,

  async handle(payload: CompApprovedPayload, _tx?: TxClient): Promise<void> {
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
        triggerType: 'compensation.approved',
        title: '보상 기획 승인',
        body: `보상 기획이 승인되었습니다 (${payload.totalEmployees}명). 통보서를 생성하세요.`,
        titleKey: 'notifications.compensation.approved.title',
        bodyKey: 'notifications.compensation.approved.body',
        bodyParams: {
          totalEmployees: String(payload.totalEmployees),
        },
        link: '/compensation',
        priority: 'high',
        companyId: payload.companyId,
      })
    }
  },
}
