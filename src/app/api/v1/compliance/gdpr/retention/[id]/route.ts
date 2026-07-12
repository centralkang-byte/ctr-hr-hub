// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Data Retention Policy Update
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { retentionPolicyUpdateSchema } from '@/lib/schemas/compliance'
import type { SessionUser } from '@/types'

export const PUT = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const body: unknown = await req.json()
    const parsed = retentionPolicyUpdateSchema.safeParse(body)
    if (!parsed.success) throw badRequest('Invalid request data', { issues: parsed.error.issues })

    const existing = await prisma.dataRetentionPolicy.findFirst({
      where: { id, companyId: user.companyId },
    })
    if (!existing) throw badRequest('Policy not found')

    try {
      const updated = await prisma.dataRetentionPolicy.update({
        where: { id },
        data: parsed.data,
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'compliance.gdpr.retention.update',
        resourceType: 'dataRetentionPolicy',
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

// ─── DELETE /api/v1/compliance/gdpr/retention/[id] ────────
// 보존 정책은 순수 설정 행 — hard delete. (soft delete 는 @@unique([companyId,
// category]) 때문에 같은 카테고리 재생성이 P2002 로 막혀 채택하지 않음)

export const DELETE = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params

    const existing = await prisma.dataRetentionPolicy.findFirst({
      where: { id, companyId: user.companyId },
    })
    if (!existing) throw badRequest('Policy not found')

    try {
      await prisma.dataRetentionPolicy.delete({ where: { id } })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'compliance.gdpr.retention.delete',
        resourceType: 'dataRetentionPolicy',
        resourceId: id,
        companyId: user.companyId,
        changes: { category: existing.category },
        ip, userAgent,
      })

      return apiSuccess({ deleted: true })
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.COMPLIANCE, ACTION.DELETE),
)
