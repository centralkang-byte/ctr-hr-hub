// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/attendance/employees/[id]
// 직원별 근태 기록 목록 (B6-1 프로필 탭용)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { notFound, isAppError, handlePrismaError } from '@/lib/errors'
import type { SessionUser } from '@/types'
import { resolveCompanyId } from '@/lib/api/companyFilter'

export const GET = withPermission(
  async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    try {
      const { id: employeeId } = await context.params
      const { searchParams } = new URL(req.url)
      const limit = Math.min(Number(searchParams.get('limit') ?? '10'), 50)
      const companyId = resolveCompanyId(user)

      const employee = await prisma.employee.findFirst({
        where: {
          id: employeeId,
          deletedAt: null,
          assignments: { some: { companyId, isPrimary: true, endDate: null } },
        },
        select: { id: true },
      })
      if (!employee) throw notFound('직원을 찾을 수 없습니다.')

      const records = await prisma.attendance.findMany({
        where: { employeeId },
        orderBy: { workDate: 'desc' },
        take: limit,
        select: {
          id: true,
          workDate: true,
          clockIn: true,
          clockOut: true,
          status: true,
          workType: true,
          totalMinutes: true,
          overtimeMinutes: true,
        },
      })

      return apiSuccess({ records, total: records.length })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.ATTENDANCE, ACTION.VIEW),
)
