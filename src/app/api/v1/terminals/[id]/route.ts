import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { terminalUpdateSchema } from '@/lib/schemas/terminal'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/terminals/[id] ─────────────────────────
// Terminal detail (excludes apiSecret)

export const GET = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const companyFilter = user.role === 'SUPER_ADMIN' ? {} : { companyId: user.companyId }

    const terminal = await prisma.attendanceTerminal.findFirst({
      where: {
        id,
        ...companyFilter,
      },
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
    })

    if (!terminal) throw notFound('단말기를 찾을 수 없습니다.')

    return apiSuccess(terminal)
  },
  perm(MODULE.ATTENDANCE, ACTION.APPROVE),
)

// ─── PUT /api/v1/terminals/[id] ─────────────────────────
// Update terminal

export const PUT = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const body: unknown = await req.json()
    const parsed = terminalUpdateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const companyFilter = user.role === 'SUPER_ADMIN' ? {} : { companyId: user.companyId }

    try {
      const existing = await prisma.attendanceTerminal.findFirst({
        where: {
          id,
          ...companyFilter,
        },
      })
      if (!existing) throw notFound('단말기를 찾을 수 없습니다.')

      const result = await prisma.attendanceTerminal.update({
        where: { id },
        data: {
          ...(parsed.data.terminalType !== undefined && { terminalType: parsed.data.terminalType }),
          ...(parsed.data.locationName !== undefined && { locationName: parsed.data.locationName }),
          ...(parsed.data.ipAddress !== undefined && { ipAddress: parsed.data.ipAddress }),
          ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }),
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'terminal.update',
        resourceType: 'terminal',
        resourceId: result.id,
        companyId: result.companyId,
        ip,
        userAgent,
      })

      return apiSuccess(result)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.ATTENDANCE, ACTION.APPROVE),
)

// ─── DELETE /api/v1/terminals/[id] ──────────────────────
// Hard delete

export const DELETE = withPermission(
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

      const result = await prisma.attendanceTerminal.delete({
        where: { id },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'terminal.delete',
        resourceType: 'terminal',
        resourceId: result.id,
        companyId: result.companyId,
        ip,
        userAgent,
      })

      return apiSuccess({ id: result.id })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.ATTENDANCE, ACTION.APPROVE),
)
