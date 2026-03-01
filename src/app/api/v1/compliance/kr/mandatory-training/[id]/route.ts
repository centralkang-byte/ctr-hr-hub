// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Mandatory Training Update
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { mandatoryTrainingUpdateSchema } from '@/lib/schemas/compliance'
import type { SessionUser } from '@/types'

export const PUT = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const body: unknown = await req.json()
    const parsed = mandatoryTrainingUpdateSchema.safeParse(body)
    if (!parsed.success) throw badRequest('Invalid request data', { issues: parsed.error.issues })

    const existing = await prisma.mandatoryTraining.findFirst({
      where: { id, companyId: user.companyId },
    })
    if (!existing) throw badRequest('Training not found')

    try {
      const updated = await prisma.mandatoryTraining.update({
        where: { id },
        data: {
          ...parsed.data,
          ...(parsed.data.dueDate ? { dueDate: new Date(parsed.data.dueDate) } : {}),
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'compliance.kr.mandatory-training.update',
        resourceType: 'mandatoryTraining',
        resourceId: id,
        companyId: user.companyId,
        changes: parsed.data,
        ip, userAgent,
      })

      return apiSuccess({ ...updated, requiredHours: Number(updated.requiredHours) })
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.COMPLIANCE, ACTION.UPDATE),
)
