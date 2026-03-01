// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Run Retention Policy Manually
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { enforceRetention } from '@/lib/compliance/gdpr'
import type { SessionUser } from '@/types'

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body = await req.json() as { policyId?: string }
    if (!body.policyId) throw badRequest('policyId is required')

    const policy = await prisma.dataRetentionPolicy.findFirst({
      where: { id: body.policyId, companyId: user.companyId },
    })
    if (!policy) throw badRequest('Policy not found')

    const result = await enforceRetention(user.companyId, body.policyId)

    const { ip, userAgent } = extractRequestMeta(req.headers)
    logAudit({
      actorId: user.employeeId,
      action: 'compliance.gdpr.retention.run',
      resourceType: 'dataRetentionPolicy',
      resourceId: body.policyId,
      companyId: user.companyId,
      changes: { processed: result.processed },
      ip, userAgent,
    })

    return apiSuccess(result)
  },
  perm(MODULE.COMPLIANCE, ACTION.APPROVE),
)
