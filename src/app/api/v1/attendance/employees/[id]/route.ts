// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/attendance/employees/[id]
// 직원별 근태 기록 목록 (B6-1 프로필 탭용)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { forbidden, notFound, isAppError, handlePrismaError } from '@/lib/errors'
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
        select: {
          id: true,
          assignments: {
            where: { isPrimary: true, endDate: null },
            take: 1,
            select: { departmentId: true },
          },
        },
      })
      if (!employee) throw notFound('직원을 찾을 수 없습니다.')

      // 타인 근태 이력은 본인·HR·(같은 부서의) MANAGER만 — EMPLOYEE 임의 직원 열람 차단 (att-04)
      const isSelf = user.employeeId === employeeId
      const isHrUp = user.role === ROLE.HR_ADMIN || user.role === ROLE.SUPER_ADMIN
      if (!isSelf && !isHrUp) {
        if (user.role !== ROLE.MANAGER) {
          throw forbidden('해당 직원의 근태 이력을 조회할 권한이 없습니다.')
        }
        // MANAGER는 자기 부서 구성원까지만 (team 라우트와 동일 스코프)
        const caller = await prisma.employee.findUnique({
          where: { id: user.employeeId },
          select: {
            assignments: {
              where: { isPrimary: true, endDate: null },
              take: 1,
              select: { departmentId: true },
            },
          },
        })
        const callerDeptId = caller?.assignments[0]?.departmentId
        const targetDeptId = employee.assignments[0]?.departmentId
        if (!callerDeptId || !targetDeptId || callerDeptId !== targetDeptId) {
          throw forbidden('해당 직원의 근태 이력을 조회할 권한이 없습니다.')
        }
      }

      const records = await prisma.attendance.findMany({
        // companyId 스코프 — 법인 이동 전 타법인 근태 기록 노출 차단 (Codex G1 r2)
        where: { employeeId, companyId },
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
