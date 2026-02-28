import { type NextRequest } from 'next/server'
import { apiSuccess } from '@/lib/api'
import { badRequest, isAppError, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { pendingActionsQuerySchema } from '@/lib/schemas/pending-actions'
import { getPendingActions } from '@/lib/pending-actions'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (
    req: NextRequest,
    _context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    try {
      const params = Object.fromEntries(req.nextUrl.searchParams.entries())
      const parsed = pendingActionsQuerySchema.safeParse(params)
      if (!parsed.success) {
        throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
      }

      const actions = await getPendingActions(user, parsed.data.limit)
      return apiSuccess(actions)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)
