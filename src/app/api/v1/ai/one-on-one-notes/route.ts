// ═══════════════════════════════════════════════════════════
// CTR HR Hub — AI One-on-One Meeting Notes
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, forbidden } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { generateOneOnOneNotes } from '@/lib/claude'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

const requestSchema = z.object({
  meetingId: z.string(),
  currentNotes: z.string().max(5000).optional(),
})

// ─── POST /api/v1/ai/one-on-one-notes ────────────────────

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = requestSchema.safeParse(body)
    if (!parsed.success) throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })

    const { meetingId, currentNotes } = parsed.data

    const meeting = await prisma.oneOnOne.findFirst({
      where: { id: meetingId, companyId: user.companyId },
      include: {
        employee: { select: { id: true, name: true } },
      },
    })
    if (!meeting) throw notFound('1:1 미팅을 찾을 수 없습니다.')
    if (meeting.managerId !== user.employeeId) throw forbidden('해당 미팅의 매니저가 아닙니다.')

    // Get previous action items
    const previousMeetings = await prisma.oneOnOne.findMany({
      where: {
        employeeId: meeting.employeeId,
        managerId: user.employeeId,
        companyId: user.companyId,
        status: 'COMPLETED',
      },
      orderBy: { completedAt: 'desc' },
      take: 1,
      select: { actionItems: true },
    })

    type ActionItem = { item: string; completed: boolean }
    const prevActions = (previousMeetings[0]?.actionItems as ActionItem[] | null) ?? []
    const previousActionItems = prevActions.map((a) => ({
      item: a.item,
      status: a.completed ? '완료' : '미완료',
    }))

    // Get employee goals (active cycle)
    const activeCycle = await prisma.performanceCycle.findFirst({
      where: { companyId: user.companyId, status: { in: ['ACTIVE', 'EVAL_OPEN'] } },
      orderBy: { createdAt: 'desc' },
    })

    let employeeGoals: { title: string; achievementRate: number }[] = []
    if (activeCycle) {
      const goals = await prisma.mboGoal.findMany({
        where: { cycleId: activeCycle.id, employeeId: meeting.employeeId, companyId: user.companyId },
        select: { title: true, achievementScore: true },
      })
      employeeGoals = goals.map((g) => ({
        title: g.title,
        achievementRate: g.achievementScore ? Number(g.achievementScore) * 20 : 0,
      }))
    }

    const result = await generateOneOnOneNotes(
      {
        employeeName: meeting.employee.name,
        meetingType: meeting.meetingType,
        previousActionItems,
        currentNotes: currentNotes ?? meeting.notes ?? '',
        employeeGoals,
      },
      user.companyId,
      user.employeeId,
    )

    return apiSuccess(result)
  },
  perm(MODULE.PERFORMANCE, ACTION.APPROVE),
)
