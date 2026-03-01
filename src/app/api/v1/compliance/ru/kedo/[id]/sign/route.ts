// ═══════════════════════════════════════════════════════════
// CTR HR Hub — KEDO Document Sign
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { kedoSignSchema } from '@/lib/schemas/compliance'
import { generateKedoSignatureHash, validateKedoSignature } from '@/lib/compliance/ru'
import type { SessionUser } from '@/types'

// ─── POST /api/v1/compliance/ru/kedo/[id]/sign ──────────
// Electronically sign a KEDO document

export const POST = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const body: unknown = await req.json()
    const parsed = kedoSignSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { signatureLevel } = parsed.data

    try {
      const existing = await prisma.kedoDocument.findFirst({
        where: { id, companyId: user.companyId },
      })
      if (!existing) throw notFound('KEDO 문서를 찾을 수 없습니다.')

      if (existing.status !== 'DRAFT' && existing.status !== 'PENDING_SIGNATURE') {
        throw badRequest('서명 대기 또는 초안 상태의 문서만 서명할 수 있습니다.')
      }

      // Validate signature level for document type
      const validation = validateKedoSignature(signatureLevel, existing.documentType)
      if (!validation.valid) {
        throw badRequest(validation.message ?? '유효하지 않은 서명 수준입니다.', {
          required: validation.required,
        })
      }

      const signedAt = new Date()
      const signatureHash = generateKedoSignatureHash(id, user.employeeId, signedAt.toISOString())

      const result = await prisma.kedoDocument.update({
        where: { id },
        data: {
          status: 'SIGNED',
          signatureLevel,
          signatureHash,
          signedAt,
          signedById: user.employeeId,
        },
        include: {
          employee: { select: { id: true, name: true, employeeNo: true } },
          signedBy: { select: { id: true, name: true } },
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'compliance.ru.kedo.sign',
        resourceType: 'kedoDocument',
        resourceId: result.id,
        companyId: user.companyId,
        changes: { signatureLevel, signatureHash },
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
