import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound, isAppError, handlePrismaError } from '@/lib/errors'
import { withAuth } from '@/lib/permissions'
import { sendNotification } from '@/lib/notifications'
import { findActiveRoleHolderId } from '@/lib/employee/active-roles'
import type { SessionUser } from '@/types'

export const POST = withAuth(
  async (
    _req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    try {
      const { id } = await context.params

      const message = await prisma.hrChatMessage.findFirst({
        where: {
          id,
          role: 'ASSISTANT',
          session: {
            employeeId: user.employeeId,
            companyId: user.companyId,
          },
        },
      })
      if (!message) throw notFound('메시지를 찾을 수 없습니다.')

      // Find an HR admin employee to escalate to (via manager chain or first available).
      // Session 208: 기존 `role: { name: 'HR_ADMIN' }` 매칭은 Role.name='HR Admin' seed
      // 와 불일치 silent fail이었음 → findActiveRoleHolderId helper로 정합화 (Role.code
      // SSOT + EmployeeRole.endDate=null + companyId scope + ACTIVE 우선/ON_LEAVE
      // fallback).
      const hrAdminId = await findActiveRoleHolderId(['HR_ADMIN'], user.companyId)

      const updated = await prisma.hrChatMessage.update({
        where: { id },
        data: {
          escalated: true,
          escalatedTo: hrAdminId,
          escalatedAt: new Date(),
        },
      })

      // Notify HR admin
      if (hrAdminId) {
        sendNotification({
          employeeId: hrAdminId,
          triggerType: 'HR_CHATBOT_ESCALATION',
          title: 'HR 챗봇 에스컬레이션',
          body: `${user.name}님이 HR 담당자 연결을 요청했습니다.`,
          titleKey: 'notifications.hrChatbotEscalation.title',
          bodyKey: 'notifications.hrChatbotEscalation.body',
          bodyParams: { userName: user.name },
          link: '/settings/hr-documents',
        })
      }

      return apiSuccess({
        ...updated,
        confidenceScore: updated.confidenceScore
          ? Number(updated.confidenceScore)
          : null,
      })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
)
