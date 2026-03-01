// ═══════════════════════════════════════════════════════════
// CTR HR Hub — KEDO Document Reject
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { kedoRejectSchema } from '@/lib/schemas/compliance'
import type { SessionUser } from '@/types'

// ─── POST /api/v1/compliance/ru/kedo/[id]/reject ────────
// Reject a KEDO document

export const POST = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const body: unknown = await req.json()
    const parsed = kedoRejectSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { rejectionReason } = parsed.data

    try {
      const existing = await prisma.kedoDocument.findFirst({
        where: { id, companyId: user.companyId },
      })
      if (!existing) throw notFound('KEDO 문서를 찾을 수 없습니다.')

      if (existing.status === 'SIGNED' || existing.status === 'REJECTED') {
        throw badRequest('이미 서명되었거나 반려된 문서입니다.')
      }

      const rejectedAt = new Date()
      const result = await prisma.kedoDocument.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectedAt,
          rejectedById: user.employeeId,
          rejectionReason,
        },
        include: {
          employee: { select: { id: true, name: true, employeeNo: true } },
          rejectedBy: { select: { id: true, name: true } },
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'compliance.ru.kedo.reject',
        resourceType: 'kedoDocument',
        resourceId: result.id,
        companyId: user.companyId,
        changes: { rejectionReason },
        ip,
        userAgent,
      })

      return apiSuccess(result)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.COMPLIANCE, ACTION.APPROVE),
)
