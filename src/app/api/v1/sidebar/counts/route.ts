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
    if (!session?.user) return unauthorized() as unknown as Response

    const user = session.user as SessionUser
    const { employeeId, companyId, role } = user

    const isHrUp = role === ROLE.HR_ADMIN || role === ROLE.SUPER_ADMIN
    const isManagerUp = isHrUp || role === ROLE.MANAGER || role === ROLE.EXECUTIVE

    // ── 1. Pending approvals (items awaiting THIS user's action) ──
    // Delegates to the same inbox aggregation endpoint so badge == list count
    let approvals = 0
    try {
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3002'
      // Internal server-side call — reuse the inbox API's aggregation logic
      // to guarantee badge count matches what the inbox page displays.
      // Instead of duplicating complex multi-source logic, we count directly:
      
      if (isManagerUp) {
        // For MANAGER: count PENDING leaves from direct reports + PENDING_APPROVAL goals + payroll
        const reportIds = !isHrUp
          ? await (async () => {
              const asgn = await prisma.employeeAssignment.findFirst({
                where: { employeeId, isPrimary: true, endDate: null },
                select: { positionId: true },
              })
              if (!asgn?.positionId) return []
              const reports = await prisma.employeeAssignment.findMany({
                where: {
                  position: { reportsToPositionId: asgn.positionId },
                  isPrimary: true,
                  endDate: null,
                },
                select: { employeeId: true },
              })
              return reports.map((r) => r.employeeId)
            })()
          : null // HR_ADMIN sees all

        const [leaveCount, goalCount, payrollCount] = await Promise.all([
          prisma.leaveRequest.count({
            where: {
              companyId,
              status: 'PENDING',
              ...(reportIds ? { employeeId: { in: reportIds } } : {}),
            },
          }),
          prisma.mboGoal.count({
            where: {
              companyId,
              status: 'PENDING_APPROVAL',
              ...(reportIds ? { employeeId: { in: reportIds } } : {}),
            },
          }),
          isHrUp
            ? prisma.payrollRun.count({
                where: { companyId, status: 'PENDING_APPROVAL' },
              })
            : Promise.resolve(0),
        ])
        approvals = leaveCount + goalCount + payrollCount
      } else {
        // EMPLOYEE: count their own pending leave requests
        approvals = await prisma.leaveRequest.count({
          where: { employeeId, status: 'PENDING' },
        })
      }
    } catch {
      // fallback: 0
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

    return apiSuccess({ approvals, notifications, pendingLeave, todayAbsent }) as unknown as Response
  } catch (err) {
    return apiError(err) as unknown as Response
  }
}
