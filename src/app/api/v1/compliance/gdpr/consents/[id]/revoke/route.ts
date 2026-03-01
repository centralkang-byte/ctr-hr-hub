// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GDPR Consent Revoke
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

export const POST = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params

    try {
      const consent = await prisma.gdprConsent.findFirst({
        where: { id, companyId: user.companyId, status: 'ACTIVE' },
      })
      if (!consent) throw badRequest('Consent not found or already revoked')

      const updated = await prisma.gdprConsent.update({
        where: { id },
        data: { status: 'REVOKED', revokedAt: new Date() },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'compliance.gdpr.consent.revoke',
        resourceType: 'gdprConsent',
        resourceId: id,
        companyId: user.companyId,
        changes: { previousStatus: 'ACTIVE', newStatus: 'REVOKED' },
        ip,
        userAgent,
      })

      return apiSuccess(updated)
    } catch (error) {
      if (error instanceof Error && 'code' in error) throw handlePrismaError(error)
      throw error
    }
  },
  perm(MODULE.COMPLIANCE, ACTION.UPDATE),
)
