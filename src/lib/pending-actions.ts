import { prisma } from '@/lib/prisma'
import { ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── Types ──────────────────────────

export type PendingActionType =
  | 'LEAVE_APPROVAL'
  | 'PROFILE_CHANGE_APPROVAL'
  | 'ONBOARDING_TASK'
  | 'EVAL_SUBMIT'
  | 'EVAL_REVIEW'
  | 'PAYROLL_REVIEW'
  | 'APPLICATION_REVIEW'
  | 'CONTRACT_EXPIRY'
  | 'WORK_PERMIT_EXPIRY'
  | 'ONE_ON_ONE_SCHEDULED'
  | 'MBO_GOAL_DRAFT'
  | 'MBO_GOAL_APPROVAL'
  | 'CHATBOT_ESCALATION'

export type PendingPriority = 'URGENT' | 'HIGH' | 'NORMAL'

export interface PendingAction {
  id: string
  type: PendingActionType
  title: string
  description: string
  priority: PendingPriority
  dueDate: Date | null
  sourceId: string
  link: string
  actionable: boolean
}

// ─── Priority Calculation ──────────────────────────

function calcPriority(dueDate: Date | null): PendingPriority {
  if (!dueDate) return 'NORMAL'
  const now = new Date()
  const diffMs = dueDate.getTime() - now.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  if (diffDays <= 1) return 'URGENT'
  if (diffDays <= 3) return 'HIGH'
  return 'NORMAL'
}

const PRIORITY_ORDER: Record<PendingPriority, number> = {
  URGENT: 0,
  HIGH: 1,
  NORMAL: 2,
}

// ─── Main Function ──────────────────────────

export async function getPendingActions(
  user: SessionUser,
  limit: number = 10,
): Promise<PendingAction[]> {
  const actions: PendingAction[] = []
  const isManager =
    user.role === ROLE.MANAGER ||
    user.role === ROLE.HR_ADMIN ||
    user.role === ROLE.SUPER_ADMIN
  const isHrAdmin =
    user.role === ROLE.HR_ADMIN || user.role === ROLE.SUPER_ADMIN
  const isExecutive = user.role === 'EXECUTIVE'

  // ─── EMPLOYEE actions ──────────────────────────

  // MBO Goals in DRAFT
  const draftGoals = await prisma.mboGoal.findMany({
    where: {
      employeeId: user.employeeId,
      companyId: user.companyId,
      status: 'DRAFT',
    },
    take: 5,
  })
  for (const g of draftGoals) {
    actions.push({
      id: `mbo-draft-${g.id}`,
      type: 'MBO_GOAL_DRAFT',
      title: `MBO 목표 작성: ${g.title}`,
      description: '초안 상태의 목표를 완성하세요.',
      priority: 'NORMAL',
      dueDate: null,
      sourceId: g.id,
      link: `/performance/mbo`,
      actionable: true,
    })
  }

  // Performance Evaluations pending self
  const pendingSelfEvals = await prisma.performanceEvaluation.findMany({
    where: {
      employeeId: user.employeeId,
      companyId: user.companyId,
      evalType: 'SELF',
      status: 'DRAFT',
    },
    include: { cycle: true },
    take: 5,
  })
  for (const e of pendingSelfEvals) {
    const due = e.cycle.evalEnd
    actions.push({
      id: `eval-self-${e.id}`,
      type: 'EVAL_SUBMIT',
      title: `자기평가 작성`,
      description: `${e.cycle.name} 자기평가를 완료하세요.`,
      priority: calcPriority(due),
      dueDate: due,
      sourceId: e.id,
      link: `/performance/evaluations`,
      actionable: true,
    })
  }

  // Onboarding tasks pending
  const onboardingTasks = await prisma.employeeOnboardingTask.findMany({
    where: {
      employeeOnboarding: {
        employeeId: user.employeeId,
      },
      status: 'PENDING',
    },
    include: {
      task: true,
      employeeOnboarding: true,
    },
    take: 5,
  })
  for (const t of onboardingTasks) {
    actions.push({
      id: `onboarding-${t.id}`,
      type: 'ONBOARDING_TASK',
      title: `온보딩: ${t.task.title}`,
      description: '온보딩 태스크를 완료하세요.',
      priority: 'NORMAL',
      dueDate: null,
      sourceId: t.id,
      link: `/onboarding`,
      actionable: true,
    })
  }

  // 1:1 meetings scheduled
  const scheduledOneOnOnes = await prisma.oneOnOne.findMany({
    where: {
      OR: [
        { employeeId: user.employeeId },
        { managerId: user.employeeId },
      ],
      companyId: user.companyId,
      status: 'SCHEDULED',
      scheduledAt: { gte: new Date() },
    },
    orderBy: { scheduledAt: 'asc' },
    take: 3,
  })
  for (const m of scheduledOneOnOnes) {
    actions.push({
      id: `1on1-${m.id}`,
      type: 'ONE_ON_ONE_SCHEDULED',
      title: `1:1 미팅 예정`,
      description: `${m.scheduledAt.toLocaleDateString('ko-KR')}에 예정된 미팅`,
      priority: calcPriority(m.scheduledAt),
      dueDate: m.scheduledAt,
      sourceId: m.id,
      link: `/performance/one-on-one`,
      actionable: false,
    })
  }

  // ─── MANAGER actions ──────────────────────────

  if (isManager) {
    // Leave requests pending approval (team)
    const pendingLeaves = await prisma.leaveRequest.findMany({
      where: {
        companyId: user.companyId,
        status: 'PENDING',
        employee: { managerId: user.employeeId },
      },
      include: { employee: { select: { name: true } } },
      take: 5,
    })
    for (const lr of pendingLeaves) {
      actions.push({
        id: `leave-${lr.id}`,
        type: 'LEAVE_APPROVAL',
        title: `휴가 승인: ${lr.employee.name}`,
        description: `${lr.startDate.toLocaleDateString('ko-KR')} ~ ${lr.endDate.toLocaleDateString('ko-KR')} (${Number(lr.days)}일)`,
        priority: calcPriority(lr.startDate),
        dueDate: lr.startDate,
        sourceId: lr.id,
        link: `/leave/requests`,
        actionable: true,
      })
    }

    // Profile change requests pending
    const pendingProfileChanges = await prisma.profileChangeRequest.findMany({
      where: {
        employee: {
          companyId: user.companyId,
          managerId: user.employeeId,
        },
        status: 'CHANGE_PENDING',
      },
      include: { employee: { select: { name: true } } },
      take: 5,
    })
    for (const pc of pendingProfileChanges) {
      actions.push({
        id: `profile-${pc.id}`,
        type: 'PROFILE_CHANGE_APPROVAL',
        title: `정보 변경 승인: ${pc.employee.name}`,
        description: `${pc.fieldName} 변경 요청`,
        priority: 'NORMAL',
        dueDate: null,
        sourceId: pc.id,
        link: `/employees`,
        actionable: true,
      })
    }

    // Evaluations pending manager review
    const pendingManagerEvals = await prisma.performanceEvaluation.findMany({
      where: {
        evaluatorId: user.employeeId,
        companyId: user.companyId,
        evalType: 'MANAGER',
        status: 'DRAFT',
      },
      include: {
        employee: { select: { name: true } },
        cycle: true,
      },
      take: 5,
    })
    for (const e of pendingManagerEvals) {
      const due = e.cycle.evalEnd
      actions.push({
        id: `eval-mgr-${e.id}`,
        type: 'EVAL_REVIEW',
        title: `평가 작성: ${e.employee.name}`,
        description: `${e.cycle.name} 관리자 평가`,
        priority: calcPriority(due),
        dueDate: due,
        sourceId: e.id,
        link: `/performance/evaluations`,
        actionable: true,
      })
    }

    // MBO Goals pending approval
    const pendingGoalApprovals = await prisma.mboGoal.findMany({
      where: {
        companyId: user.companyId,
        status: 'PENDING_APPROVAL',
        employee: { managerId: user.employeeId },
      },
      include: { employee: { select: { name: true } } },
      take: 5,
    })
    for (const g of pendingGoalApprovals) {
      actions.push({
        id: `mbo-approve-${g.id}`,
        type: 'MBO_GOAL_APPROVAL',
        title: `MBO 승인: ${g.employee.name}`,
        description: g.title,
        priority: 'NORMAL',
        dueDate: null,
        sourceId: g.id,
        link: `/performance/mbo`,
        actionable: true,
      })
    }

    // Contract expiring within 30 days
    const thirtyDaysLater = new Date()
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30)
    const expiringContracts = await prisma.contractHistory.findMany({
      where: {
        companyId: user.companyId,
        endDate: {
          gte: new Date(),
          lte: thirtyDaysLater,
        },
        employee: { managerId: user.employeeId },
      },
      include: { employee: { select: { name: true } } },
      take: 3,
    })
    for (const c of expiringContracts) {
      actions.push({
        id: `contract-${c.id}`,
        type: 'CONTRACT_EXPIRY',
        title: `계약 만료 임박: ${c.employee.name}`,
        description: `${c.endDate!.toLocaleDateString('ko-KR')} 만료`,
        priority: calcPriority(c.endDate),
        dueDate: c.endDate,
        sourceId: c.id,
        link: `/employees`,
        actionable: false,
      })
    }

    // Work permits expiring within 60 days
    const sixtyDaysLater = new Date()
    sixtyDaysLater.setDate(sixtyDaysLater.getDate() + 60)
    const expiringPermits = await prisma.workPermit.findMany({
      where: {
        companyId: user.companyId,
        expiryDate: {
          gte: new Date(),
          lte: sixtyDaysLater,
        },
        status: 'ACTIVE',
        deletedAt: null,
        employee: { managerId: user.employeeId },
      },
      include: { employee: { select: { name: true } } },
      take: 3,
    })
    for (const wp of expiringPermits) {
      actions.push({
        id: `workpermit-${wp.id}`,
        type: 'WORK_PERMIT_EXPIRY',
        title: `취업허가 만료: ${wp.employee.name}`,
        description: `${wp.expiryDate!.toLocaleDateString('ko-KR')} 만료`,
        priority: calcPriority(wp.expiryDate),
        dueDate: wp.expiryDate,
        sourceId: wp.id,
        link: `/employees`,
        actionable: false,
      })
    }
  }

  // ─── HR ADMIN actions ──────────────────────────

  if (isHrAdmin) {
    // PayrollRun in DRAFT or REVIEW
    const pendingPayrolls = await prisma.payrollRun.findMany({
      where: {
        companyId: user.companyId,
        status: { in: ['DRAFT', 'REVIEW'] },
      },
      take: 3,
    })
    for (const pr of pendingPayrolls) {
      actions.push({
        id: `payroll-${pr.id}`,
        type: 'PAYROLL_REVIEW',
        title: `급여 처리: ${pr.name || pr.yearMonth}`,
        description: `${pr.status === 'DRAFT' ? '초안' : '검토'} 상태`,
        priority: pr.status === 'REVIEW' ? 'HIGH' : 'NORMAL',
        dueDate: pr.payDate,
        sourceId: pr.id,
        link: `/payroll/${pr.id}`,
        actionable: true,
      })
    }

    // All pending leave requests (company-wide)
    const allPendingLeaves = await prisma.leaveRequest.count({
      where: {
        companyId: user.companyId,
        status: 'PENDING',
      },
    })
    if (allPendingLeaves > 0) {
      actions.push({
        id: `leave-all-pending`,
        type: 'LEAVE_APPROVAL',
        title: `전사 휴가 승인 대기`,
        description: `${allPendingLeaves}건의 휴가 신청이 대기 중`,
        priority: allPendingLeaves > 10 ? 'HIGH' : 'NORMAL',
        dueDate: null,
        sourceId: 'all',
        link: `/leave/requests`,
        actionable: true,
      })
    }

    // Chatbot escalations
    const escalations = await prisma.hrChatMessage.findMany({
      where: {
        escalated: true,
        escalationResolved: false,
        session: { companyId: user.companyId },
      },
      take: 3,
    })
    for (const esc of escalations) {
      actions.push({
        id: `escalation-${esc.id}`,
        type: 'CHATBOT_ESCALATION',
        title: `챗봇 에스컬레이션`,
        description: '직원이 HR 담당자 연결을 요청했습니다.',
        priority: 'HIGH',
        dueDate: null,
        sourceId: esc.id,
        link: `/settings/hr-documents`,
        actionable: true,
      })
    }
  }

  // Sort by priority then by dueDate
  actions.sort((a, b) => {
    const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    if (priorityDiff !== 0) return priorityDiff
    if (a.dueDate && b.dueDate) return a.dueDate.getTime() - b.dueDate.getTime()
    if (a.dueDate) return -1
    if (b.dueDate) return 1
    return 0
  })

  return actions.slice(0, limit)
}
