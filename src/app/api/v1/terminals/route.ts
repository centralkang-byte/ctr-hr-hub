import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { terminalSearchSchema, terminalCreateSchema } from '@/lib/schemas/terminal'
import { generateTerminalSecret } from '@/lib/terminal'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/terminals ──────────────────────────────
// List terminals (company-scoped, paginated)

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = terminalSearchSchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { page, limit, terminalType, isActive } = parsed.data
    const companyFilter = user.role === 'SUPER_ADMIN' ? {} : { companyId: user.companyId }

    const where = {
      ...companyFilter,
      ...(terminalType ? { terminalType } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    }

    const [terminals, total] = await Promise.all([
      prisma.attendanceTerminal.findMany({
        where,
        select: {
          id: true,
          terminalCode: true,
          terminalType: true,
          locationName: true,
          ipAddress: true,
          isActive: true,
          lastHeartbeatAt: true,
          companyId: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.attendanceTerminal.count({ where }),
    ])

    return apiPaginated(terminals, buildPagination(page, limit, total))
  },
  perm(MODULE.ATTENDANCE, ACTION.APPROVE),
)

// ─── POST /api/v1/terminals ─────────────────────────────
// Create a new terminal

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = terminalCreateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const effectiveCompanyId =
      user.role === 'SUPER_ADMIN'
        ? ((parsed.data as Record<string, unknown>).companyId as string) ?? user.companyId
        : user.companyId

    try {
      const terminal = await prisma.attendanceTerminal.create({
        data: {
          ...parsed.data,
          companyId: effectiveCompanyId,
          apiSecret: generateTerminalSecret(),
          isActive: true,
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'terminal.create',
        resourceType: 'terminal',
        resourceId: terminal.id,
        companyId: terminal.companyId,
        ip,
        userAgent,
      })

      return apiSuccess(terminal, 201)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.ATTENDANCE, ACTION.APPROVE),
)
