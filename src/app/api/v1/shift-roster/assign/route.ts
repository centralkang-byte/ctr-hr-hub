// ═══════════════════════════════════════════════════════════
// CTR HR Hub — PUT /api/v1/shift-roster/assign
// 직원 근무 스케줄 배정
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, isAppError, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { employeeScheduleAssignSchema } from '@/lib/schemas/shift'
import type { SessionUser } from '@/types'

// ─── PUT — 스케줄 배정 ──────────────────────────────────────

export const PUT = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    try {
      const body: unknown = await req.json()
      const parsed = employeeScheduleAssignSchema.safeParse(body)

      if (!parsed.success) {
        throw badRequest('잘못된 요청입니다.', {
          issues: parsed.error.issues as unknown as Record<string, unknown>,
        })
      }

      const {
        employeeId,
        scheduleId,
        shiftGroup,
        effectiveFrom,
        effectiveTo,
      } = parsed.data

      // 기간 중복 검사
      const overlap = await prisma.employeeSchedule.findFirst({
        where: {
          employeeId,
          effectiveFrom: {
            lte: effectiveTo
              ? new Date(effectiveTo)
              : new Date('9999-12-31'),
          },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: new Date(effectiveFrom) } },
          ],
        },
      })

      if (overlap) {
        throw badRequest('해당 기간에 이미 배정된 스케줄이 있습니다.')
      }

      const assignment = await prisma.employeeSchedule.create({
        data: {
          employeeId,
          scheduleId,
          shiftGroup: shiftGroup ?? null,
          effectiveFrom: new Date(effectiveFrom),
          effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
        },
      })

      // 감사 로그
      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'shift.roster.assign',
        resourceType: 'employee_schedule',
        resourceId: assignment.id,
        companyId: user.companyId,
        ip,
        userAgent,
      })

      return apiSuccess(assignment, 201)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.ATTENDANCE, ACTION.APPROVE),
)
