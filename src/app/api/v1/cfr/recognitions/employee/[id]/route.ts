// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Employee Recognition Summary (Profile Widget)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/cfr/recognitions/employee/[id] ──────────

export const GET = withPermission(
  async (_req: NextRequest, context, user: SessionUser) => {
    const { id: employeeId } = await context.params

    const [received, sent] = await Promise.all([
      prisma.recognition.groupBy({
        by: ['coreValue'],
        where: { receiverId: employeeId, companyId: user.companyId },
        _count: { id: true },
      }),
      prisma.recognition.count({
        where: { senderId: employeeId, companyId: user.companyId },
      }),
    ])

    const totalReceived = received.reduce((sum, v) => sum + v._count.id, 0)
    const valueBreakdown = received.map((v) => ({
      value: v.coreValue,
      count: v._count.id,
    }))

    // Recent recognitions (last 5)
    const recentRecognitions = await prisma.recognition.findMany({
      where: { receiverId: employeeId, companyId: user.companyId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        sender: { select: { name: true } },
      },
    })

    return apiSuccess({
      receivedCount: totalReceived,
      sentCount: sent,
      valueBreakdown,
      recent: recentRecognitions.map((r) => ({
        senderName: r.sender.name,
        coreValue: r.coreValue,
        message: r.message,
        createdAt: r.createdAt,
      })),
    })
  },
  perm(MODULE.PERFORMANCE, ACTION.VIEW),
)
