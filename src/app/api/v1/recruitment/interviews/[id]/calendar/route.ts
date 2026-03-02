// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST/PUT/DELETE /api/v1/recruitment/interviews/[id]/calendar
// 캘린더 이벤트 생성/변경/취소
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound, badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'
import {
  createCalendarEvent,
  updateCalendarEvent,
  cancelCalendarEvent,
} from '@/lib/calendar-scheduler'

// ─── Schemas ────────────────────────────────────────────────

const createSchema = z.object({
  slotStart: z.string(),
  slotEnd: z.string(),
  isOnline: z.boolean().default(true),
})

const updateSchema = z.object({
  slotStart: z.string(),
  slotEnd: z.string(),
})

// ─── Helpers ────────────────────────────────────────────────

async function getScheduleWithAadId(id: string) {
  const schedule = await prisma.interviewSchedule.findUnique({
    where: { id },
    include: {
      interviewer: {
        select: {
          id: true,
          name: true,
          email: true,
          ssoIdentities: {
            where: { provider: 'azure-ad' },
            select: { providerAccountId: true },
            take: 1,
          },
        },
      },
      application: {
        select: {
          applicant: { select: { name: true, email: true } },
        },
      },
    },
  })

  if (!schedule) throw notFound('면접 일정을 찾을 수 없습니다.')

  const aadId = schedule.interviewer.ssoIdentities[0]?.providerAccountId
  if (!aadId) throw badRequest('면접관의 Microsoft 계정이 연동되지 않았습니다.')

  return { schedule, aadId }
}

// ─── POST: 캘린더 이벤트 생성 ───────────────────────────────

export const POST = withPermission(
  async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id } = await context.params
    const body: unknown = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { slotStart, slotEnd, isOnline } = parsed.data
    const { schedule, aadId } = await getScheduleWithAadId(id)

    if (schedule.calendarEventId) {
      throw badRequest('이미 캘린더 이벤트가 등록되어 있습니다.')
    }

    const applicantName = schedule.application.applicant.name
    const subject = `[면접] ${applicantName} - ${schedule.interviewer.name}`

    try {
      const event = await createCalendarEvent(
        aadId,
        [schedule.interviewer.email],
        subject,
        slotStart,
        slotEnd,
        isOnline,
      )

      const updated = await prisma.interviewSchedule.update({
        where: { id },
        data: {
          calendarEventId: event.id,
          meetingLink: event.onlineMeeting?.joinUrl ?? null,
          teamsAutoScheduled: true,
          scheduledAt: new Date(slotStart),
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'interview.calendar.create',
        resourceType: 'interviewSchedule',
        resourceId: id,
        companyId: user.companyId,
        ip,
        userAgent,
      })

      return apiSuccess(updated, 201)
    } catch (error) {
      if (error instanceof Error && error.message.includes('캘린더')) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.RECRUITMENT, ACTION.UPDATE),
)

// ─── PUT: 캘린더 이벤트 변경 ────────────────────────────────

export const PUT = withPermission(
  async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id } = await context.params
    const body: unknown = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { slotStart, slotEnd } = parsed.data
    const { schedule, aadId } = await getScheduleWithAadId(id)

    if (!schedule.calendarEventId) {
      throw badRequest('등록된 캘린더 이벤트가 없습니다.')
    }

    try {
      const event = await updateCalendarEvent(aadId, schedule.calendarEventId, {
        start: slotStart,
        end: slotEnd,
      })

      const updated = await prisma.interviewSchedule.update({
        where: { id },
        data: {
          scheduledAt: new Date(slotStart),
          meetingLink: event.onlineMeeting?.joinUrl ?? schedule.meetingLink,
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'interview.calendar.update',
        resourceType: 'interviewSchedule',
        resourceId: id,
        companyId: user.companyId,
        ip,
        userAgent,
      })

      return apiSuccess(updated)
    } catch (error) {
      if (error instanceof Error && error.message.includes('캘린더')) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.RECRUITMENT, ACTION.UPDATE),
)

// ─── DELETE: 캘린더 이벤트 취소 ──────────────────────────────

export const DELETE = withPermission(
  async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id } = await context.params
    const { schedule, aadId } = await getScheduleWithAadId(id)

    if (!schedule.calendarEventId) {
      throw badRequest('등록된 캘린더 이벤트가 없습니다.')
    }

    try {
      await cancelCalendarEvent(aadId, schedule.calendarEventId)

      const updated = await prisma.interviewSchedule.update({
        where: { id },
        data: {
          calendarEventId: null,
          meetingLink: null,
          teamsAutoScheduled: false,
          status: 'CANCELLED',
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'interview.calendar.cancel',
        resourceType: 'interviewSchedule',
        resourceId: id,
        companyId: user.companyId,
        ip,
        userAgent,
      })

      return apiSuccess(updated)
    } catch (error) {
      if (error instanceof Error && error.message.includes('캘린더')) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.RECRUITMENT, ACTION.UPDATE),
)
