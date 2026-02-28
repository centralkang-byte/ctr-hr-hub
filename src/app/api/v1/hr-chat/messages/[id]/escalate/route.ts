import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound, isAppError, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { sendNotification } from '@/lib/notifications'
import type { SessionUser } from '@/types'

export const POST = withPermission(
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
          companyId: user.companyId,
          status: 'ACTIVE',
          managerId: null, // Top-level employee, likely HR admin
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
  perm(MODULE.HR_CHATBOT, ACTION.CREATE),
)
