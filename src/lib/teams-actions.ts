// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Teams Adaptive Card Action Executor
// cardType별 분기 처리 (휴가승인, 온보딩 완료 등)
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'

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
  input: CardActionInput,
): Promise<CardActionResult> {
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
      return handleLeaveApproval(referenceId, action, actionBy)
    case 'ONBOARDING_TASK_DUE':
      return handleOnboardingTaskComplete(referenceId, action, actionBy)
    case 'CHATBOT_ESCALATION':
      return handleChatbotEscalation(referenceId, action, actionBy)
    default:
      return { success: true, message: '액션이 기록되었습니다.' }
  }
}

async function handleLeaveApproval(
  requestId: string,
  action: string,
  approverId: string,
): Promise<CardActionResult> {
  const request = await prisma.leaveRequest.findUnique({
    where: { id: requestId },
  })

  if (!request) {
    return { success: false, message: '휴가 요청을 찾을 수 없습니다.' }
  }

  if (request.status !== 'PENDING') {
    return { success: false, message: `이미 처리된 요청입니다. (상태: ${request.status})` }
  }

  const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED'

  await prisma.leaveRequest.update({
    where: { id: requestId },
    data: {
      status: newStatus,
      approvedBy: approverId,
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
      ? '휴가가 승인되었습니다.'
      : '휴가가 반려되었습니다.',
  }
}

async function handleOnboardingTaskComplete(
  taskId: string,
  action: string,
  completedBy: string,
): Promise<CardActionResult> {
  if (action !== 'complete') {
    return { success: false, message: '알 수 없는 액션입니다.' }
  }

  const task = await prisma.employeeOnboardingTask.findUnique({
    where: { id: taskId },
  })

  if (!task) {
    return { success: false, message: '온보딩 태스크를 찾을 수 없습니다.' }
  }

  if (task.status === 'DONE') {
    return { success: false, message: '이미 완료된 태스크입니다.' }
  }

  await prisma.employeeOnboardingTask.update({
    where: { id: taskId },
    data: {
      status: 'DONE',
      completedAt: new Date(),
      completedBy,
    },
  })

  return { success: true, message: '온보딩 태스크가 완료되었습니다.' }
}

async function handleChatbotEscalation(
  sessionId: string,
  action: string,
  assignedBy: string,
): Promise<CardActionResult> {
  if (action !== 'assign') {
    return { success: false, message: '알 수 없는 액션입니다.' }
  }

  const session = await prisma.hrChatSession.findUnique({
    where: { id: sessionId },
  })

  if (!session) {
    return { success: false, message: '챗봇 세션을 찾을 수 없습니다.' }
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

  return { success: true, message: '담당자가 배정되었습니다.' }
}
