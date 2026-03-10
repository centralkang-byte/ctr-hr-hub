// ═══════════════════════════════════════════════════════════
// GET /api/v1/sidebar/counts — 사이드바 뱃지 카운트
// 역할별 COUNT 쿼리만 실행 (경량)
// ═══════════════════════════════════════════════════════════

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'
import { unauthorized } from '@/lib/errors'
import { ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return unauthorized()

    const user = session.user as SessionUser
    const { employeeId, companyId, role } = user

    const isHrUp = role === ROLE.HR_ADMIN || role === ROLE.SUPER_ADMIN
    const isManagerUp = isHrUp || role === ROLE.MANAGER || role === ROLE.EXECUTIVE

    // ── 1. Pending approvals (items awaiting THIS user's action) ──
    // Uses the same logic as /api/v1/approvals/inbox?countOnly=true
    let approvals = 0
    if (isManagerUp) {
      // Count PENDING leave requests in company
      const leaveCount = await prisma.leaveRequest.count({
        where: {
          companyId,
          status: 'PENDING',
        },
      })
      // Count PENDING payroll runs for HR
      const payrollCount = isHrUp
        ? await prisma.payrollRun.count({
            where: { companyId, status: 'DRAFT' },
          })
        : 0
      approvals = leaveCount + payrollCount
    } else {
      // EMPLOYEE: count their own pending leave requests
      approvals = await prisma.leaveRequest.count({
        where: { employeeId, status: 'PENDING' },
      })
    }

    // ── 2. Unread notifications ──
    const notifications = await prisma.notification.count({
      where: { employeeId, isRead: false },
    })

    // ── 3. Pending leave requests (HR/MANAGER view) ──
    const pendingLeave = isManagerUp
      ? await prisma.leaveRequest.count({
          where: { companyId, status: 'PENDING' },
        })
      : 0

    // ── 4. Today absent count (HR only) ──
    let todayAbsent = 0
    if (isHrUp) {
      const today = new Date()
      const dateStr = today.toISOString().split('T')[0]
      const todayStart = new Date(`${dateStr}T00:00:00.000Z`)
      const todayEnd = new Date(`${dateStr}T23:59:59.999Z`)

      todayAbsent = await prisma.attendance.count({
        where: {
          companyId,
          workDate: { gte: todayStart, lte: todayEnd },
          status: 'ABSENT',
        },
      })
    }

    return apiSuccess({ approvals, notifications, pendingLeave, todayAbsent })
  } catch (err) {
    return apiError(err)
  }
}
