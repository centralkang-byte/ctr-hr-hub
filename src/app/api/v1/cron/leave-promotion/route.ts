// CRON: secured by CRON_SECRET header, not user session
// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/cron/leave-promotion
// 연차 사용 촉진 (KR 법인, step 1=60일/2=30일/3=10일)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyCronSecret } from '@/lib/cron-auth'
import { sendNotification } from '@/lib/notifications'
import { apiSuccess, apiError } from '@/lib/api'
import { unauthorized } from '@/lib/errors'

const STEP_THRESHOLDS = [
  { step: 1, daysBeforeAnniversary: 60, label: '60일 전' },
  { step: 2, daysBeforeAnniversary: 30, label: '30일 전' },
  { step: 3, daysBeforeAnniversary: 10, label: '10일 전' },
]

export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) return apiError(unauthorized('인증 실패'))

  const now = new Date()
  const currentYear = now.getFullYear()
  let sentCount = 0

  // KR 법인 ACTIVE 직원 조회
  const employees = await prisma.employee.findMany({
    where: {
      deletedAt: null,
      assignments: {
        some: {
          status: 'ACTIVE',
          isPrimary: true,
          endDate: null,
          company: { countryCode: 'KR' },
        },
      },
    },
    select: {
      id: true,
      name: true,
      hireDate: true,
      employeeLeaveBalances: {
        where: { year: currentYear },
        select: { grantedDays: true, usedDays: true, pendingDays: true },
      },
    },
  })

  for (const emp of employees) {
    // 이번 해 입사 기념일 계산
    const anniversary = new Date(
      currentYear,
      emp.hireDate.getMonth(),
      emp.hireDate.getDate(),
    )

    // 기념일이 이미 지났으면 내년 기념일
    if (anniversary <= now) {
      anniversary.setFullYear(currentYear + 1)
    }

    const daysUntilAnniversary = Math.ceil(
      (anniversary.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    )

    // 잔여 연차 계산
    const totalGranted = emp.employeeLeaveBalances.reduce(
      (sum, b) => sum + Number(b.grantedDays),
      0,
    )
    const totalUsed = emp.employeeLeaveBalances.reduce(
      (sum, b) => sum + Number(b.usedDays),
      0,
    )
    const totalPending = emp.employeeLeaveBalances.reduce(
      (sum, b) => sum + Number(b.pendingDays),
      0,
    )
    const remainingDays = totalGranted - totalUsed - totalPending

    if (remainingDays <= 0) continue

    for (const threshold of STEP_THRESHOLDS) {
      if (daysUntilAnniversary > threshold.daysBeforeAnniversary) continue

      try {
        await prisma.leavePromotionLog.create({
          data: {
            employeeId: emp.id,
            year: currentYear,
            step: threshold.step,
            remainingDays,
          },
        })

        sendNotification({
          employeeId: emp.id,
          triggerType: 'LEAVE_PROMOTION',
          title: `연차 사용 촉진 안내 (${threshold.label})`,
          body: `${emp.name}님, 잔여 연차가 ${remainingDays}일 남아있습니다. 입사 기념일까지 ${daysUntilAnniversary}일 남았습니다. 연차 사용을 권장드립니다.`,
          titleKey: 'notifications.leavePromotion.title',
          bodyKey: 'notifications.leavePromotion.body',
          bodyParams: { name: emp.name, remainingDays, daysUntilAnniversary },
          link: '/leave',
        })

        sentCount++
      } catch {
        // unique constraint → 이미 발송됨 (idempotent)
      }

      break // 가장 높은 step만 발송
    }
  }

  return apiSuccess({ processed: employees.length, sent: sentCount })
}
