// ═══════════════════════════════════════════════════════════
// GET /api/v1/sidebar/counts — 사이드바 뱃지 카운트
// 역할별 COUNT 쿼리만 실행 (경량) + Redis 캐시 (30초, 사용자 격리)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { isAppError, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { withCache, CACHE_STRATEGY } from '@/lib/cache'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'

export const GET = withCache(withPermission(
  async (
    _req: NextRequest,
    _context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    try {
      const { employeeId, companyId, role } = user

      const isHrUp = role === ROLE.HR_ADMIN || role === ROLE.SUPER_ADMIN
      const isManagerUp = isHrUp || role === ROLE.MANAGER || role === ROLE.EXECUTIVE

      // ── 1. Pending approvals ──
      let approvals = 0
      try {
        if (isManagerUp) {
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
            : null

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

      return apiSuccess({ approvals, notifications, pendingLeave, todayAbsent })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
), CACHE_STRATEGY.SIDEBAR, 'user')
