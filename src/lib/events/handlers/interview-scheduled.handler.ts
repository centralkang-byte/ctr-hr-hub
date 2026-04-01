// Recruitment: INTERVIEW_SCHEDULED Handler
// 면접관에게 면접 스케줄 알림

import type { DomainEventHandler, InterviewScheduledPayload, TxClient } from '../types'
import { DOMAIN_EVENTS } from '../types'
import { sendNotification } from '@/lib/notifications'
import { formatToTz } from '@/lib/timezone'

export const interviewScheduledHandler: DomainEventHandler<'INTERVIEW_SCHEDULED'> = {
  eventName: DOMAIN_EVENTS.INTERVIEW_SCHEDULED,

  async handle(payload: InterviewScheduledPayload, _tx?: TxClient): Promise<void> {
    const formattedDate = formatToTz(
      payload.scheduledAt,
      payload.timezone,
      'yyyy-MM-dd HH:mm',
    )

    // Notify the interviewer
    sendNotification({
      employeeId: payload.interviewerId,
      triggerType: 'recruitment.interview_scheduled',
      title: '면접 일정 등록',
      body: `[${payload.postingTitle}] ${payload.applicantName}님 면접이 ${formattedDate} (${payload.timezone})에 예정되었습니다.`,
      titleKey: 'notifications.recruitment.interviewScheduled.title',
      bodyKey: 'notifications.recruitment.interviewScheduled.body',
      bodyParams: {
        applicantName: payload.applicantName,
        postingTitle: payload.postingTitle,
        scheduledAt: formattedDate,
        timezone: payload.timezone,
      },
      link: `/recruitment`,
      priority: 'normal',
      companyId: payload.companyId,
    })
  },
}
