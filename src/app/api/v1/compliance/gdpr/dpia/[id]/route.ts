// ═══════════════════════════════════════════════════════════
// CTR HR Hub — DPIA Detail & Update
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { dpiaUpdateSchema } from '@/lib/schemas/compliance'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (_req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const record = await prisma.dpiaRecord.findFirst({
      where: { id, companyId: user.companyId },
      include: { reviewedBy: { select: { id: true, name: true } } },
    })
    if (!record) throw badRequest('DPIA record not found')
    return apiSuccess(record)
  },
  perm(MODULE.COMPLIANCE, ACTION.VIEW),
)

export const PUT = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const body: unknown = await req.json()
    const parsed = dpiaUpdateSchema.safeParse(body)
    if (!parsed.success) throw badRequest('Invalid request data', { issues: parsed.error.issues })

    const existing = await prisma.dpiaRecord.findFirst({
      where: { id, companyId: user.companyId },
    })
    if (!existing) throw badRequest('DPIA record not found')

    try {
      const updated = await prisma.dpiaRecord.update({
        where: { id },
        data: {
          ...parsed.data,
          ...(parsed.data.status === 'APPROVED' ? {
            approvedAt: new Date(),
            reviewedById: user.employeeId,
            reviewedAt: new Date(),
          } : {}),
          ...(parsed.data.status === 'REJECTED' ? {
            reviewedById: user.employeeId,
            reviewedAt: new Date(),
          } : {}),
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'compliance.gdpr.dpia.update',
        resourceType: 'dpiaRecord',
        resourceId: id,
        companyId: user.companyId,
        changes: parsed.data,
        ip, userAgent,
      })

      return apiSuccess(updated)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.COMPLIANCE, ACTION.UPDATE),
)
