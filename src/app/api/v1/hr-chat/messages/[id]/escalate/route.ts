import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound, isAppError, handlePrismaError } from '@/lib/errors'
import { withAuth } from '@/lib/permissions'
import { sendNotification } from '@/lib/notifications'
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

      // Find an HR admin employee to escalate to (via manager chain or first available)
      const hrAdmin = await prisma.employee.findFirst({
        where: {
          assignments: {
            some: {
              companyId: user.companyId,
              status: 'ACTIVE',
              isPrimary: true,
              endDate: null,
            },
          },
          employeeRoles: { some: { role: { name: 'HR_ADMIN' } } },
        },
        select: { id: true },
      })

      const updated = await prisma.hrChatMessage.update({
        where: { id },
        data: {
          escalated: true,
          escalatedTo: hrAdmin?.id ?? null,
          escalatedAt: new Date(),
        },
      })

      // Notify HR admin
      if (hrAdmin) {
        sendNotification({
          employeeId: hrAdmin.id,
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
