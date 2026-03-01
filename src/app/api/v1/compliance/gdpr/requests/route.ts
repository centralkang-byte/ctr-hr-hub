// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GDPR Data Subject Requests List & Create
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { gdprRequestSearchSchema, gdprRequestCreateSchema } from '@/lib/schemas/compliance'
import { calculateGdprDeadline } from '@/lib/compliance/gdpr'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = gdprRequestSearchSchema.safeParse(params)
    if (!parsed.success) throw badRequest('Invalid parameters', { issues: parsed.error.issues })

    const { page, limit, employeeId, requestType, status } = parsed.data
    const where = {
      companyId: user.companyId,
      ...(employeeId ? { employeeId } : {}),
      ...(requestType ? { requestType } : {}),
      ...(status ? { status } : {}),
    }

    const [requests, total] = await Promise.all([
      prisma.gdprRequest.findMany({
        where,
        include: {
          employee: { select: { id: true, name: true, employeeNo: true } },
          completedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.gdprRequest.count({ where }),
    ])

    return apiPaginated(requests, buildPagination(page, limit, total))
  },
  perm(MODULE.COMPLIANCE, ACTION.VIEW),
)

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = gdprRequestCreateSchema.safeParse(body)
    if (!parsed.success) throw badRequest('Invalid request data', { issues: parsed.error.issues })

    try {
      const now = new Date()
      const gdprRequest = await prisma.gdprRequest.create({
        data: {
          companyId: user.companyId,
          employeeId: parsed.data.employeeId,
          requestType: parsed.data.requestType,
          description: parsed.data.description,
          deadline: calculateGdprDeadline(now),
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'compliance.gdpr.request.create',
        resourceType: 'gdprRequest',
        resourceId: gdprRequest.id,
        companyId: user.companyId,
        changes: { requestType: parsed.data.requestType, employeeId: parsed.data.employeeId },
        ip,
        userAgent,
      })

      return apiSuccess(gdprRequest, 201)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.COMPLIANCE, ACTION.CREATE),
)
