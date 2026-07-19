// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET/PATCH /api/v1/leave-of-absence/[id]
// 휴직 상세 조회 + 상태 전이 (approve/reject/activate/return/complete/cancel)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError, isAppError, notFound } from '@/lib/errors'
import { withAuth, withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { sendNotification } from '@/lib/notifications'
import {
  parseLoaTransitionInput,
  transitionLeaveOfAbsence,
  type LoaTransitionResult,
} from '@/lib/loa/service'
import type { SessionUser } from '@/types'

type RouteContext = { params: Promise<Record<string, string>> }

export const GET = withPermission(
  async (_req: NextRequest, context: RouteContext, user: SessionUser) => {
    const { id } = await context.params
    const record = await prisma.leaveOfAbsence.findFirst({
      where: { id, companyId: user.companyId, deletedAt: null },
      include: {
        employee: { select: { id: true, name: true, nameEn: true, employeeNo: true } },
        type: true,
        approver: { select: { id: true, name: true } },
        rejecter: { select: { id: true, name: true } },
        parent: { select: { id: true, startDate: true, actualEndDate: true, splitSequence: true } },
        splits: {
          select: { id: true, startDate: true, expectedEndDate: true, status: true, splitSequence: true },
          orderBy: { splitSequence: 'asc' },
        },
      },
    })
    if (!record) throw notFound('휴직 기록을 찾을 수 없습니다.')
    return apiSuccess(record)
  },
  perm(MODULE.LEAVE, ACTION.VIEW),
)

export const PATCH = withAuth(
  async (req: NextRequest, context: RouteContext, user: SessionUser) => {
    try {
      const { id } = await context.params
      let body: unknown
      try {
        body = await req.json()
      } catch {
        throw badRequest('요청 본문이 올바른 JSON 형식이 아닙니다.')
      }
      const input = parseLoaTransitionInput(body)
      const result = await transitionLeaveOfAbsence({
        id,
        companyId: user.companyId,
        actorId: user.employeeId,
        input,
      })

      if (input.action === 'activate') notifyLoaActivation(result)
      return apiSuccess(result)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
)

function notifyLoaActivation(record: LoaTransitionResult): void {
  void prisma.employee.findMany({
    where: {
      deletedAt: null,
      employeeRoles: {
        some: {
          role: { code: 'HR_ADMIN' },
          endDate: null,
          companyId: record.companyId,
        },
      },
      assignments: {
        some: { companyId: record.companyId, isPrimary: true, endDate: null },
      },
    },
    select: { id: true },
  }).then((hrAdmins) => {
    const payType = record.payType ?? record.type.payType ?? 'UNPAID'
    const payRate = record.payRate ?? record.type.payRate
    for (const hr of hrAdmins) {
      sendNotification({
        employeeId: hr.id,
        triggerType: 'LOA_ACTIVATED',
        title: '휴직 활성화 알림',
        body: `${record.type.name} 휴직이 시작되었습니다 (${payType}${payRate ? `, ${payRate}%` : ''})`,
        priority: 'normal',
        link: '/leave-of-absence',
      })
    }
  }).catch((error) => {
    Sentry.captureException(error, {
      tags: { operation: 'loa-activation-notification' },
    })
  })
}
