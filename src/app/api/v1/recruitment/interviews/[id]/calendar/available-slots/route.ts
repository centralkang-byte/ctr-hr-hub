// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/recruitment/interviews/[id]/calendar/available-slots
// 면접관 빈시간 조회 (다음 5 영업일)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound, badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'
import {
  getNextBusinessDays,
  getFreeBusy,
  findCommonSlots,
} from '@/lib/calendar-scheduler'

export const GET = withPermission(
  async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id } = await context.params

    // 면접 일정 + 면접관 정보 조회
    const schedule = await prisma.interviewSchedule.findUnique({
      where: { id },
      include: {
        interviewer: {
          select: {
            id: true,
            name: true,
            assignments: {
              where: { isPrimary: true, endDate: null },
              take: 1,
              select: { companyId: true },
            },
            ssoIdentities: {
              where: { provider: 'azure-ad' },
              select: { providerAccountId: true },
              take: 1,
            },
          },
        },
      },
    })

    if (!schedule) {
      throw notFound('면접 일정을 찾을 수 없습니다.')
    }

    const aadId = schedule.interviewer.ssoIdentities[0]?.providerAccountId
    if (!aadId) {
      throw badRequest('면접관의 Microsoft 계정이 연동되지 않았습니다.')
    }

    const durationMinutes = schedule.durationMinutes || 60
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const companyId = ((extractPrimaryAssignment(schedule.interviewer.assignments ?? []) as any)?.companyId as string | undefined) ?? user.companyId

    // 다음 5 영업일 계산
    const businessDays = await getNextBusinessDays(companyId, 5)
    const startDate = businessDays[0]
    const endDate = businessDays[businessDays.length - 1]

    // Graph API FreeBusy 조회
    const freeBusy = await getFreeBusy(
      [aadId],
      `${startDate}T00:00:00`,
      `${endDate}T23:59:59`,
    )

    // 빈시간 슬롯 계산
    const slots = findCommonSlots(freeBusy, durationMinutes)

    return apiSuccess({
      slots,
      interviewerName: schedule.interviewer.name,
      durationMinutes,
      businessDays,
    })
  },
  perm(MODULE.RECRUITMENT, ACTION.VIEW),
)
