import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import {
  badRequest,
  notFound,
  isAppError,
  handlePrismaError,
} from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { messageFeedbackSchema } from '@/lib/schemas/hr-chat'
import type { SessionUser } from '@/types'

export const PUT = withPermission(
  async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    try {
      const { id } = await context.params
      const body: unknown = await req.json()
      const parsed = messageFeedbackSchema.safeParse(body)
      if (!parsed.success) {
        throw badRequest('입력값이 올바르지 않습니다.', {
          issues: parsed.error.issues,
        })
      }

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

      const updated = await prisma.hrChatMessage.update({
        where: { id },
        data: { feedback: parsed.data.feedback },
      })

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
  perm(MODULE.HR_CHATBOT, ACTION.UPDATE),
)
