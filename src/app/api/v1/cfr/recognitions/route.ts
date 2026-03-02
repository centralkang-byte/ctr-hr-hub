// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Recognition Feed & Create
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError, notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, CTR_VALUES } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── Schemas ──────────────────────────────────────────────

const feedSchema = z.object({
  cursor: z.string().optional(),
  value: z.enum(['CHALLENGE', 'TRUST', 'RESPONSIBILITY', 'RESPECT']).optional(),
  limit: z.coerce.number().int().positive().max(50).default(20),
})

const createSchema = z.object({
  receiverId: z.string(),
  coreValue: z.enum(CTR_VALUES),
  message: z.string().min(10).max(500),
  isPublic: z.boolean().default(true),
})

// ─── GET /api/v1/cfr/recognitions ────────────────────────

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = feedSchema.safeParse(params)
    if (!parsed.success) throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })

    const { cursor, value, limit } = parsed.data

    const where = {
      companyId: user.companyId,
      isPublic: true,
      ...(value ? { coreValue: value } : {}),
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    }

    const recognitions = await prisma.recognition.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      include: {
        sender: {
          select: {
            id: true, name: true,
            assignments: {
              where: { isPrimary: true, endDate: null },
              take: 1,
              include: { department: { select: { name: true } } },
            },
          },
        },
        receiver: {
          select: {
            id: true, name: true,
            assignments: {
              where: { isPrimary: true, endDate: null },
              take: 1,
              include: { department: { select: { name: true } } },
            },
          },
        },
        likes: { select: { employeeId: true } },
      },
    })

    const hasMore = recognitions.length > limit
    const items = hasMore ? recognitions.slice(0, limit) : recognitions

    const feed = items.map((r) => ({
      id: r.id,
      sender: r.sender,
      receiver: r.receiver,
      coreValue: r.coreValue,
      message: r.message,
      createdAt: r.createdAt,
      likeCount: r.likes.length,
      likedByMe: r.likes.some((l) => l.employeeId === user.employeeId),
    }))

    const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null

    return apiSuccess({ items: feed, nextCursor })
  },
  perm(MODULE.PERFORMANCE, ACTION.VIEW),
)

// ─── POST /api/v1/cfr/recognitions ───────────────────────

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })

    const { receiverId, coreValue, message, isPublic } = parsed.data

    if (receiverId === user.employeeId) throw badRequest('본인에게 칭찬을 보낼 수 없습니다.')

    const receiver = await prisma.employee.findFirst({
      where: {
        id: receiverId,
        assignments: {
          some: { companyId: user.companyId, status: 'ACTIVE', isPrimary: true, endDate: null },
        },
      },
    })
    if (!receiver) throw notFound('받는 사람을 찾을 수 없습니다.')

    try {
      const recognition = await prisma.$transaction(async (tx) => {
        const r = await tx.recognition.create({
          data: {
            senderId: user.employeeId,
            receiverId,
            companyId: user.companyId,
            coreValue,
            message,
            isPublic,
          },
          include: {
            sender: { select: { id: true, name: true } },
            receiver: { select: { id: true, name: true } },
          },
        })

        const valueLabel = { CHALLENGE: '도전', TRUST: '신뢰', RESPONSIBILITY: '책임', RESPECT: '존중' }[coreValue]

        await tx.notification.create({
          data: {
            employeeId: receiverId,
            triggerType: 'RECOGNITION_RECEIVED',
            title: '칭찬을 받았습니다!',
            body: `${user.name ?? '동료'}님이 ${valueLabel} 핵심가치로 칭찬을 보냈습니다.`,
            channel: 'IN_APP',
            link: '/performance/recognition',
          },
        })

        return r
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'cfr.recognition.create',
        resourceType: 'recognition',
        resourceId: recognition.id,
        companyId: user.companyId,
        changes: { receiverId, coreValue },
        ip,
        userAgent,
      })

      return apiSuccess(recognition, 201)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.PERFORMANCE, ACTION.CREATE),
)
