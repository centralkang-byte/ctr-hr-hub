// CRON: secured by CRON_SECRET header, not user session
// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/cron/loa-return-reminder
// 복직 예정일 알림 (7일/3일/1일 전 직원 + HR Admin)
// Schedule: 0 0 * * * (UTC 00:00 = KST 09:00)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyCronSecret } from '@/lib/cron-auth'
import { sendNotification } from '@/lib/notifications'
import { apiSuccess, apiError } from '@/lib/api'
import { unauthorized } from '@/lib/errors'

const THRESHOLDS = [
  { days: 7 },
  { days: 3 },
  { days: 1 },
]

export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) return apiError(unauthorized('인증 실패'))

  const now = new Date()
  let sentCount = 0

  for (const threshold of THRESHOLDS) {
    // 오늘 + threshold.days가 expectedEndDate인 ACTIVE LOA 조회
    const targetDate = new Date(now)
    targetDate.setDate(targetDate.getDate() + threshold.days)
    const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate())
    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayEnd.getDate() + 1)

    const records = await prisma.leaveOfAbsence.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        expectedEndDate: { gte: dayStart, lt: dayEnd },
      },
      include: {
        employee: { select: { id: true, name: true } },
        type: { select: { name: true } },
        company: { select: { id: true } },
      },
    })

    for (const record of records) {
      // 중복 방지: 같은 직원 + 같은 triggerType + 최근 24시간 이내 알림 확인
      const existing = await prisma.notification.findFirst({
        where: {
          employeeId: record.employee.id,
          triggerType: 'LOA_RETURN_REMINDER',
          createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
          metadata: { path: ['daysRemaining'], equals: threshold.days },
        },
      })
      if (existing) continue

      // 직원에게 알림
      sendNotification({
        employeeId: record.employee.id,
        triggerType: 'LOA_RETURN_REMINDER',
        title: `복직 예정일 ${threshold.days}일 전`,
        body: `${record.employee.name}님, ${record.type.name} 복직 예정일이 ${threshold.days}일 남았습니다. 복직 신청을 준비해 주세요.`,
        titleKey: 'notifications.loaReturnReminder.title',
        bodyKey: 'notifications.loaReturnReminder.body',
        bodyParams: { days: threshold.days, employeeName: record.employee.name, typeName: record.type.name },
        priority: threshold.days <= 1 ? 'high' : 'normal',
        link: '/leave-of-absence',
        metadata: { daysRemaining: threshold.days, loaId: record.id },
      })
      sentCount++

      // 해당 법인 HR Admin에게 알림
      const hrAdmins = await prisma.employee.findMany({
        where: {
          deletedAt: null,
          employeeRoles: { some: { role: { code: 'HR_ADMIN' } } },
          assignments: { some: { companyId: record.company.id, isPrimary: true, endDate: null } },
        },
        select: { id: true },
      })

      for (const hr of hrAdmins) {
        sendNotification({
          employeeId: hr.id,
          triggerType: 'LOA_RETURN_REMINDER',
          title: `복직 예정 알림 (${threshold.days}일 전)`,
          body: `${record.employee.name} — ${record.type.name} 복직 예정일이 ${threshold.days}일 남았습니다.`,
          titleKey: 'notifications.loaReturnReminderHr.title',
          bodyKey: 'notifications.loaReturnReminderHr.body',
          bodyParams: { days: threshold.days, employeeName: record.employee.name, typeName: record.type.name },
          priority: 'normal',
          link: '/leave-of-absence',
          metadata: { daysRemaining: threshold.days, loaId: record.id, employeeName: record.employee.name },
        })
      }
    }
  }

  return apiSuccess({ sent: sentCount })
}
