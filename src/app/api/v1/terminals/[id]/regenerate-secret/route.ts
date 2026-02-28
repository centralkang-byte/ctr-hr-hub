import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { generateTerminalSecret } from '@/lib/terminal'
import type { SessionUser } from '@/types'

// ─── POST /api/v1/terminals/[id]/regenerate-secret ──────
// Regenerate terminal API secret (shown only once)

export const POST = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const companyFilter = user.role === 'SUPER_ADMIN' ? {} : { companyId: user.companyId }

    try {
      const existing = await prisma.attendanceTerminal.findFirst({
        where: {
          id,
          ...companyFilter,
        },
      })
      if (!existing) throw notFound('단말기를 찾을 수 없습니다.')

      const newSecret = generateTerminalSecret()

      await prisma.attendanceTerminal.update({
        where: { id },
        data: { apiSecret: newSecret },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'terminal.regenerate_secret',
        resourceType: 'terminal',
        resourceId: id,
        companyId: existing.companyId,
        ip,
        userAgent,
      })

      return apiSuccess({ id, apiSecret: newSecret })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.ATTENDANCE, ACTION.APPROVE),
)
