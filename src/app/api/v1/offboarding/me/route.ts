// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/offboarding/me
// Stage 5-B: 직원 본인의 퇴직 처리 현황 조회
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withAuth } from '@/lib/permissions'

export const GET = withAuth(async (_req: NextRequest, _context, user) => {
  const offboarding = await prisma.employeeOffboarding.findFirst({
    where: {
      employeeId: user.employeeId,
      status: 'IN_PROGRESS',
    },
    include: {
      checklist: { select: { name: true } },
      offboardingTasks: {
        include: {
          task: {
            select: {
              title: true,
              description: true,
              assigneeType: true,
              dueDaysBefore: true,
              sortOrder: true,
              isRequired: true,
            },
          },
        },
        orderBy: { task: { sortOrder: 'asc' } },
      },
    },
  })

  if (!offboarding) {
    // Return null — client handles the "no active offboarding" state
    return apiSuccess(null)
  }

  // Compute D-day from lastWorkingDate
  const now = new Date()
  const lastDay = new Date(offboarding.lastWorkingDate)
  const dDay = Math.ceil((lastDay.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  // Compute progress
  const total     = offboarding.offboardingTasks.length
  const completed = offboarding.offboardingTasks.filter((t) => t.status === 'DONE').length
  const progress  = total > 0 ? Math.round((completed / total) * 100) : 0

  // Build task list with computed dueDate
  const tasks = offboarding.offboardingTasks.map((t) => {
    const dueDaysMs = t.task.dueDaysBefore * 24 * 60 * 60 * 1000
    const dueDate   = new Date(lastDay.getTime() - dueDaysMs)
    const isOverdue = t.status !== 'DONE' && dueDate < now

    return {
      id:           t.id,
      taskId:       t.taskId,
      title:        t.task.title,
      description:  t.task.description,
      assigneeType: t.task.assigneeType,   // EMPLOYEE | MANAGER | HR | IT | FINANCE
      isRequired:   t.task.isRequired,
      sortOrder:    t.task.sortOrder,
      status:       t.status,              // PENDING | IN_PROGRESS | DONE | BLOCKED
      completedAt:  t.completedAt?.toISOString() ?? null,
      dueDate:      dueDate.toISOString(),
      isOverdue,
    }
  })

  // Fetch leave balance for reference section
  const currentYear = now.getFullYear()
  const leaveBalances = await prisma.employeeLeaveBalance.findMany({
    where: {
      employeeId: user.employeeId,
      year: currentYear,
    },
    include: { policy: { select: { name: true } } },
  })
  const annualLeave = leaveBalances.find(
    (lb) => lb.policy.name.includes('연차') || lb.policy.name.includes('Annual'),
  )

  return apiSuccess({
    offboardingId:   offboarding.id,
    status:          offboarding.status,
    lastWorkingDate: offboarding.lastWorkingDate.toISOString(),
    dDay,
    progress,
    completed,
    total,
    checklistName:   offboarding.checklist.name,
    tasks,
    reference: {
      annualLeaveRemaining: annualLeave
      ? Number(annualLeave.grantedDays) + Number(annualLeave.carryOverDays) - Number(annualLeave.usedDays) - Number(annualLeave.pendingDays)
      : null,
    },
  })
})
