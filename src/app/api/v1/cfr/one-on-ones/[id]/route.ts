// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 1:1 Meeting Detail & Update
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError, notFound, forbidden } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'
import type { OneOnOneStatus } from '@/generated/prisma/client'

// ─── Schema ──────────────────────────────────────────────

const actionItemSchema = z.object({
  item: z.string().min(1),
  assignee: z.enum(['MANAGER', 'EMPLOYEE']),
  dueDate: z.string().optional(),
  completed: z.boolean().default(false),
})

const updateSchema = z.object({
  notes: z.string().max(10000).optional(),
  actionItems: z.array(actionItemSchema).optional(),
  status: z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']).optional(),
  aiSummary: z.string().optional(),
  sentimentTag: z.string().max(20).optional().nullable(),
})

// ─── GET /api/v1/cfr/one-on-ones/[id] ────────────────────

export const GET = withPermission(
  async (_req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params

    const meeting = await prisma.oneOnOne.findFirst({
      where: {
        id,
        companyId: user.companyId,
        OR: [
          { managerId: user.employeeId },
          { employeeId: user.employeeId },
        ],
      },
      include: {
        employee: {
          select: {
            id: true, name: true, employeeNo: true,
            assignments: {
              where: { isPrimary: true, endDate: null },
              take: 1,
              include: {
                department: { select: { name: true } },
                jobGrade: { select: { name: true } },
              },
            },
          },
        },
        manager: { select: { id: true, name: true } },
      },
    })

    if (!meeting) throw notFound('1:1 미팅을 찾을 수 없습니다.')

    // Get previous action items from recent completed meetings
    const previousMeetings = await prisma.oneOnOne.findMany({
      where: {
        employeeId: meeting.employeeId,
        managerId: meeting.managerId,
        companyId: user.companyId,
        status: 'COMPLETED',
        id: { not: id },
      },
      orderBy: { completedAt: 'desc' },
      take: 3,
      select: { actionItems: true, completedAt: true },
    })

    return apiSuccess({
      ...meeting,
      previousMeetings,
    })
  },
  perm(MODULE.PERFORMANCE, ACTION.VIEW),
)

// ─── PUT /api/v1/cfr/one-on-ones/[id] ────────────────────

export const PUT = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params
    const body: unknown = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })

    const existing = await prisma.oneOnOne.findFirst({
      where: { id, companyId: user.companyId },
    })
    if (!existing) throw notFound('1:1 미팅을 찾을 수 없습니다.')
    if (existing.managerId !== user.employeeId) throw forbidden('해당 미팅의 매니저가 아닙니다.')

    try {
      const meeting = await prisma.oneOnOne.update({
        where: { id },
        data: {
          ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
          ...(parsed.data.actionItems ? { actionItems: parsed.data.actionItems } : {}),
          ...(parsed.data.aiSummary ? { aiSummary: parsed.data.aiSummary } : {}),
          ...(parsed.data.sentimentTag !== undefined ? { sentimentTag: parsed.data.sentimentTag } : {}),
          ...(parsed.data.status ? {
            status: parsed.data.status as OneOnOneStatus,
            ...(parsed.data.status === 'COMPLETED' ? { completedAt: new Date() } : {}),
          } : {}),
        },
        include: {
          employee: { select: { id: true, name: true } },
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'cfr.one_on_one.update',
        resourceType: 'oneOnOne',
        resourceId: id,
        companyId: user.companyId,
        changes: parsed.data,
        ip,
        userAgent,
      })

      return apiSuccess(meeting)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.PERFORMANCE, ACTION.UPDATE),
)
