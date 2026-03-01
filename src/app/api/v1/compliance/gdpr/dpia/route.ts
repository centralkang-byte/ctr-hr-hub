// ═══════════════════════════════════════════════════════════
// CTR HR Hub — DPIA List & Create
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { dpiaSearchSchema, dpiaCreateSchema } from '@/lib/schemas/compliance'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = dpiaSearchSchema.safeParse(params)
    if (!parsed.success) throw badRequest('Invalid parameters', { issues: parsed.error.issues })

    const { page, limit, status } = parsed.data
    const where = {
      companyId: user.companyId,
      ...(status ? { status } : {}),
    }

    const [records, total] = await Promise.all([
      prisma.dpiaRecord.findMany({
        where,
        include: { reviewedBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.dpiaRecord.count({ where }),
    ])

    return apiPaginated(records, buildPagination(page, limit, total))
  },
  perm(MODULE.COMPLIANCE, ACTION.VIEW),
)

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = dpiaCreateSchema.safeParse(body)
    if (!parsed.success) throw badRequest('Invalid request data', { issues: parsed.error.issues })

    try {
      const record = await prisma.dpiaRecord.create({
        data: { companyId: user.companyId, ...parsed.data },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'compliance.gdpr.dpia.create',
        resourceType: 'dpiaRecord',
        resourceId: record.id,
        companyId: user.companyId,
        changes: { title: parsed.data.title },
        ip, userAgent,
      })

      return apiSuccess(record, 201)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.COMPLIANCE, ACTION.CREATE),
)
