// ═══════════════════════════════════════════════════════════
// CTR HR Hub — KEDO Document Detail & Update
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { kedoUpdateSchema } from '@/lib/schemas/compliance'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/compliance/ru/kedo/[id] ────────────────
// Single KEDO document detail

export const GET = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params

    const document = await prisma.kedoDocument.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        employee: { select: { id: true, name: true, employeeNo: true } },
        signedBy: { select: { id: true, name: true } },
        rejectedBy: { select: { id: true, name: true } },
      },
    })

    if (!document) throw notFound('KEDO 문서를 찾을 수 없습니다.')

    return apiSuccess(document)
  },
  perm(MODULE.COMPLIANCE, ACTION.VIEW),
)

// ─── PUT /api/v1/compliance/ru/kedo/[id] ────────────────
// Update KEDO document (only DRAFT documents can be edited)

export const PUT = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const body: unknown = await req.json()
    const parsed = kedoUpdateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    try {
      const existing = await prisma.kedoDocument.findFirst({
        where: { id, companyId: user.companyId },
      })
      if (!existing) throw notFound('KEDO 문서를 찾을 수 없습니다.')
      if (existing.status !== 'DRAFT') {
        throw badRequest('초안 상태의 문서만 수정할 수 있습니다.')
      }

      const data = parsed.data
      const result = await prisma.kedoDocument.update({
        where: { id },
        data: {
          ...(data.documentType !== undefined && { documentType: data.documentType }),
          ...(data.title !== undefined && { title: data.title }),
          ...(data.content !== undefined && { content: data.content }),
          ...(data.signatureLevel !== undefined && { signatureLevel: data.signatureLevel }),
          ...(data.expiresAt !== undefined && {
            expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
          }),
        },
        include: {
          employee: { select: { id: true, name: true, employeeNo: true } },
          signedBy: { select: { id: true, name: true } },
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'compliance.ru.kedo.update',
        resourceType: 'kedoDocument',
        resourceId: result.id,
        companyId: user.companyId,
        ip,
        userAgent,
      })

      return apiSuccess(result)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.COMPLIANCE, ACTION.UPDATE),
)
