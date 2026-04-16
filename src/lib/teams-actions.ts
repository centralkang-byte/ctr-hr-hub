// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Teams Adaptive Card Action Executor
// cardType별 분기 처리 (휴가승인, 온보딩 완료 등)
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { serverT } from '@/lib/server-i18n'
import type { Locale } from '@/i18n/config'

interface CardActionInput {
  cardType: string
  referenceId: string
  action: string
  actionBy: string
  companyId: string
}

interface CardActionResult {
  success: boolean
  message: string
}

export async function executeCardAction(
  locale: Locale,
  input: CardActionInput,
): Promise<CardActionResult> {
  const t = (key: string, params?: Record<string, string | number>) => serverT(locale, key, params)
  const { cardType, referenceId, action, actionBy, companyId } = input

  // TeamsCardAction 레코드 업데이트
  await prisma.teamsCardAction.updateMany({
    where: {
      companyId,
      cardType,
      referenceId,
      actionTaken: null,
    },
    data: {
      actionTaken: action,
      actionBy,
      actionAt: new Date(),
    },
  })

  switch (cardType) {
    case 'LEAVE_APPROVAL':
      return handleLeaveApproval(locale, referenceId, action, actionBy)
    case 'ONBOARDING_TASK_DUE':
      return handleOnboardingTaskComplete(locale, referenceId, action, actionBy)
    case 'CHATBOT_ESCALATION':
      return handleChatbotEscalation(locale, referenceId, action, actionBy)
    default:
      return { success: true, message: await t('teams.actions.recorded') }
  }
}

async function handleLeaveApproval(
  locale: Locale,
  requestId: string,
  action: string,
  approverId: string,
): Promise<CardActionResult> {
  const t = (key: string, params?: Record<string, string | number>) => serverT(locale, key, params)

  const request = await prisma.leaveRequest.findUnique({
    where: { id: requestId },
  })

  if (!request) {
    return { success: false, message: await t('teams.actions.leaveNotFound') }
  }

  if (request.status !== 'PENDING') {
    return { success: false, message: await t('teams.actions.alreadyProcessed', { status: request.status }) }
  }

  const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED'

  await prisma.leaveRequest.update({
    where: { id: requestId },
    data: {
      status: newStatus,
      approvedById: approverId,
      approvedAt: new Date(),
    },
  })

  // 승인 시 잔여일 차감
  if (newStatus === 'APPROVED') {
    await prisma.employeeLeaveBalance.updateMany({
      where: {
        employeeId: request.employeeId,
        policyId: request.policyId,
      },
      data: {
        usedDays: { increment: Number(request.days) },
      },
    })
  }

  return {
    success: true,
    message: newStatus === 'APPROVED'
      ? await t('teams.actions.leaveApproved')
      : await t('teams.actions.leaveRejected'),
  }
}

async function handleOnboardingTaskComplete(
  locale: Locale,
  taskId: string,
  action: string,
  completedById: string,
): Promise<CardActionResult> {
  const t = (key: string) => serverT(locale, key)

  if (action !== 'complete') {
    return { success: false, message: await t('teams.actions.unknownAction') }
  }

  const task = await prisma.employeeOnboardingTask.findUnique({
    where: { id: taskId },
  })

  if (!task) {
    return { success: false, message: await t('teams.actions.taskNotFound') }
  }

  if (task.status === 'DONE') {
    return { success: false, message: await t('teams.actions.taskAlreadyDone') }
  }

  await prisma.employeeOnboardingTask.update({
    where: { id: taskId },
    data: {
      status: 'DONE',
      completedAt: new Date(),
      completedById,
    },
  })

  return { success: true, message: await t('teams.actions.taskCompleted') }
}

async function handleChatbotEscalation(
  locale: Locale,
  sessionId: string,
  action: string,
  assignedBy: string,
): Promise<CardActionResult> {
  const t = (key: string) => serverT(locale, key)

  if (action !== 'assign') {
    return { success: false, message: await t('teams.actions.unknownAction') }
  }

  const session = await prisma.hrChatSession.findUnique({
    where: { id: sessionId },
  })

  if (!session) {
    return { success: false, message: await t('teams.actions.sessionNotFound') }
  }

  // 에스컬레이션 상태 업데이트 — assignedBy를 담당자로 지정
  await prisma.hrChatMessage.updateMany({
    where: {
      sessionId,
      escalated: true,
      escalationResolved: false,
    },
    data: {
      escalatedTo: assignedBy,
      escalationResolved: true,
    },
  })

  return { success: true, message: await t('teams.actions.agentAssigned') }
}
