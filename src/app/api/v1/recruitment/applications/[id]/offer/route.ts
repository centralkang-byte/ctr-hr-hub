// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/recruitment/applications/[id]/offer
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { eventBus } from '@/lib/events/event-bus'
import { DOMAIN_EVENTS } from '@/lib/events/types'
import type { SessionUser } from '@/types'

// ─── Offer Schema ────────────────────────────────────────

const offerSchema = z.object({
  offeredSalary: z.number().positive('연봉은 양수여야 합니다.'),
  offeredDate: z.string().datetime({ message: '올바른 날짜 형식을 입력해주세요.' }),
  expectedStartDate: z.string().datetime({ message: '올바른 날짜 형식을 입력해주세요.' }),
})

// ─── POST /api/v1/recruitment/applications/[id]/offer ─────

export const POST = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params

    const companyFilter =
      user.role === ROLE.SUPER_ADMIN
        ? {}
        : { posting: { companyId: user.companyId } }

    const existing = await prisma.application.findFirst({
      where: { id, ...companyFilter },
      include: {
        posting: { select: { companyId: true, title: true } },
        applicant: { select: { name: true, email: true } },
      },
    })

    if (!existing) {
      throw notFound('해당 지원 내역을 찾을 수 없습니다. applications/[id]의 id는 Application ID입니다.')
    }

    // Cannot set offer on HIRED or REJECTED applications
    if (existing.stage === 'HIRED') {
      throw badRequest('이미 채용 완료된 지원자에게는 오퍼를 설정할 수 없습니다.')
    }
    if (existing.stage === 'REJECTED') {
      throw badRequest('반려된 지원자에게는 오퍼를 설정할 수 없습니다.')
    }

    const body: unknown = await req.json()
    const parsed = offerSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { offeredSalary, offeredDate, expectedStartDate } = parsed.data

    try {
      const updated = await prisma.application.update({
        where: { id },
        data: {
          offeredSalary,
          offeredDate: new Date(offeredDate),
          expectedStartDate: new Date(expectedStartDate),
          stage: 'OFFER',
        },
        include: {
          applicant: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          posting: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'recruitment.application.offer',
        resourceType: 'application',
        resourceId: id,
        companyId: existing.posting.companyId,
        changes: {
          offeredSalary,
          offeredDate,
          expectedStartDate,
          previousStage: existing.stage,
          newStage: 'OFFER',
        },
        ip,
        userAgent,
      })

      // Domain event: 오퍼 발송
      eventBus.publish(DOMAIN_EVENTS.OFFER_SENT, {
        ctx: {
          companyId: existing.posting.companyId,
          actorId: user.employeeId,
          occurredAt: new Date(),
        },
        applicationId: id,
        applicantName: existing.applicant.name,
        applicantEmail: existing.applicant.email ?? '',
        postingTitle: existing.posting.title,
        companyId: existing.posting.companyId,
        offeredSalary,
        expectedStartDate,
      })

      return apiSuccess({
        ...updated,
        offeredSalary: updated.offeredSalary
          ? Number(updated.offeredSalary)
          : null,
      })
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.RECRUITMENT, ACTION.UPDATE),
)

// ─── Offer Response Schema ──────────────────────────────

const offerResponseSchema = z.object({
  response: z.enum(['ACCEPT', 'DECLINE']),
  declineReason: z.string().optional(),
}).refine(
  (data) => {
    if (data.response === 'DECLINE' && !data.declineReason?.trim()) return false
    return true
  },
  { message: '거절 시 사유를 입력해주세요.', path: ['declineReason'] },
)

// ─── PATCH /api/v1/recruitment/applications/[id]/offer ───
// 오퍼 수락/거절

export const PATCH = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params

    const companyFilter =
      user.role === ROLE.SUPER_ADMIN
        ? {}
        : { posting: { companyId: user.companyId } }

    const existing = await prisma.application.findFirst({
      where: { id, ...companyFilter },
      include: {
        posting: { select: { companyId: true, title: true, positionId: true } },
        applicant: { select: { name: true, email: true } },
      },
    })

    if (!existing) {
      throw notFound('해당 지원 내역을 찾을 수 없습니다.')
    }

    if (existing.stage !== 'OFFER') {
      throw badRequest('오퍼 단계의 지원자만 수락/거절할 수 있습니다.')
    }

    const body: unknown = await req.json()
    const parsed = offerResponseSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { response, declineReason } = parsed.data
    const now = new Date()
    const newStage = response === 'ACCEPT' ? 'OFFER_ACCEPTED' : 'OFFER_DECLINED'

    try {
      const updated = await prisma.application.update({
        where: { id },
        data: {
          stage: newStage,
          offerRespondedAt: now,
          ...(declineReason ? { offerDeclineReason: declineReason } : {}),
        },
        include: {
          applicant: { select: { id: true, name: true, email: true } },
          posting: { select: { id: true, title: true } },
        },
      })

      const eventName = response === 'ACCEPT'
        ? DOMAIN_EVENTS.OFFER_ACCEPTED
        : DOMAIN_EVENTS.OFFER_DECLINED

      eventBus.publish(eventName, {
        ctx: {
          companyId: existing.posting.companyId,
          actorId: user.employeeId,
          occurredAt: now,
        },
        applicationId: id,
        applicantName: existing.applicant.name,
        applicantEmail: existing.applicant.email ?? '',
        postingTitle: existing.posting.title,
        companyId: existing.posting.companyId,
        ...(declineReason ? { declineReason } : {}),
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: `recruitment.application.offer_${response.toLowerCase()}`,
        resourceType: 'application',
        resourceId: id,
        companyId: existing.posting.companyId,
        changes: {
          previousStage: 'OFFER',
          newStage,
          ...(declineReason ? { declineReason } : {}),
        },
        ip,
        userAgent,
      })

      return apiSuccess({
        ...updated,
        offeredSalary: updated.offeredSalary
          ? Number(updated.offeredSalary)
          : null,
      })
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.RECRUITMENT, ACTION.UPDATE),
)
