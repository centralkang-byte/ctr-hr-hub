import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, isAppError, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { sessionCreateSchema } from '@/lib/schemas/hr-chat'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (
    _req: NextRequest,
    _context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    try {
      const sessions = await prisma.hrChatSession.findMany({
        where: {
          employeeId: user.employeeId,
          companyId: user.companyId,
          isActive: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        include: {
          _count: { select: { messages: true } },
        },
      })

      return apiSuccess(sessions)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.HR_CHATBOT, ACTION.VIEW),
)

export const POST = withPermission(
  async (
    req: NextRequest,
    _context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    try {
      const body: unknown = await req.json()
      const parsed = sessionCreateSchema.safeParse(body)
      if (!parsed.success) {
        throw badRequest('입력값이 올바르지 않습니다.', { issues: parsed.error.issues })
      }

      const session = await prisma.hrChatSession.create({
        data: {
          employeeId: user.employeeId,
          companyId: user.companyId,
          title: parsed.data.title ?? '새 대화',
        },
      })

      return apiSuccess(session, 201)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.HR_CHATBOT, ACTION.CREATE),
)
