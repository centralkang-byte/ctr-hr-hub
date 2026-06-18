// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Teams Adaptive Card Action Executor
// cardType별 분기 처리 (휴가승인, 온보딩 완료 등)
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { serverT } from '@/lib/server-i18n'
import type { Locale } from '@/i18n/config'
import { resolveLeaveTypeDefId } from '@/lib/leave/resolveLeaveTypeDefId'
import { leaveTypeUsesBalance } from '@/lib/leave/eventBasedLeave'
import { getLeaveBalanceYear } from '@/lib/leave/leaveBalanceYear'

// 트랜잭션 내부에서 사용자 메시지를 들고 롤백하기 위한 sentinel
class LeaveActionAbort extends Error {
  constructor(public messageKey: string, public params?: Record<string, string | number>) {
    super(messageKey)
  }
}

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

  // 잔여일 갱신 — SSOT = LeaveYearBalance (웹 approve/reject route와 정합).
  // 적립형만. 잔액 행은 시작일의 연도 단일 행 (getLeaveBalanceYear).
  // 웹 신청이 pending을 올려두므로 승인=used+days·pending-days, 반려=pending-days(복구).
  // 상태 전이(claim) + 잔액 변경을 단일 트랜잭션으로 묶어 동시/이중 승인 이중차감 차단
  // (claim의 status='PENDING' 조건이 직렬화하고, 잔액 행 없으면 throw로 전체 롤백).
  const leaveTypeDefId = request.leaveTypeDefId ?? (await resolveLeaveTypeDefId(request.policyId))
  const usesBalance = !!leaveTypeDefId && (await leaveTypeUsesBalance(leaveTypeDefId))
  const days = Number(request.days)
  const year = getLeaveBalanceYear(request.startDate)

  try {
    await prisma.$transaction(async (tx) => {
      const claim = await tx.leaveRequest.updateMany({
        where: { id: requestId, status: 'PENDING' },
        data: {
          status: newStatus,
          approvedById: approverId,
          approvedAt: new Date(),
        },
      })
      if (claim.count === 0) {
        throw new LeaveActionAbort('teams.actions.alreadyProcessed', { status: newStatus })
      }

      if (usesBalance && newStatus === 'APPROVED') {
        // 웹 approve route와 동일한 상한 가드 — Teams만 잔액 상한을 우회하지 않도록
        const rows = await tx.$queryRaw<Array<{ id: string }>>`
          UPDATE leave_year_balances
          SET used = used + ${days}, pending = GREATEST(pending - ${days}, 0), updated_at = NOW()
          WHERE employee_id = ${request.employeeId} AND leave_type_def_id = ${leaveTypeDefId} AND year = ${year}
            AND (used + ${days}) <= (entitled + carried_over + adjusted)
          RETURNING id`
        if (rows.length === 0) {
          const exists = await tx.leaveYearBalance.findFirst({
            where: { employeeId: request.employeeId, leaveTypeDefId, year },
          })
          throw new LeaveActionAbort(
            exists ? 'teams.actions.leaveInsufficientBalance' : 'teams.actions.leaveNotFound',
          )
        }
      } else if (usesBalance && newStatus === 'REJECTED') {
        await tx.$executeRaw`
          UPDATE leave_year_balances
          SET pending = GREATEST(pending - ${days}, 0), updated_at = NOW()
          WHERE employee_id = ${request.employeeId} AND leave_type_def_id = ${leaveTypeDefId} AND year = ${year}`
      }
    })
  } catch (e) {
    if (e instanceof LeaveActionAbort) {
      return { success: false, message: await t(e.messageKey, e.params) }
    }
    throw e
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
