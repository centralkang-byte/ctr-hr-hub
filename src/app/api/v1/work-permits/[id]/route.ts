// ═══════════════════════════════════════════════════════════
// CTR HR Hub — PUT/DELETE /api/v1/work-permits/[id]
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound, badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── Schema ───────────────────────────────────────────────

const workPermitUpdateSchema = z.object({
  permitType: z
    .enum(['WORK_VISA', 'WORK_PERMIT', 'RESIDENCE_PERMIT', 'I9_VERIFICATION', 'OTHER'])
    .optional(),
  permitNumber: z.string().nullable().optional(),
  issuingCountry: z.string().min(2).max(3).optional(),
  issuingAuthority: z.string().nullable().optional(),
  issueDate: z.string().date().optional(),
  expiryDate: z.string().date().nullable().optional(),
  status: z.enum(['ACTIVE', 'EXPIRED', 'REVOKED', 'PENDING_RENEWAL']).optional(),
  documentKey: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
}).strict()

// ─── Helper: find work permit with company scope ──────────

async function findWorkPermit(id: string, user: SessionUser) {
  const companyFilter = user.role === 'SUPER_ADMIN' ? {} : { companyId: user.companyId }

  const permit = await prisma.workPermit.findFirst({
    where: { id, deletedAt: null, ...companyFilter },
    select: { id: true, companyId: true },
  })
  return permit
}

// ─── PUT /api/v1/work-permits/[id] ────────────────────────

export const PUT = withPermission(
  async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id } = await context.params

    const permit = await findWorkPermit(id, user)
    if (!permit) throw notFound('Work Permit을 찾을 수 없습니다.')

    const body: unknown = await req.json()
    const parsed = workPermitUpdateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const updateData: Record<string, unknown> = {}
    if (parsed.data.permitType !== undefined) updateData.permitType = parsed.data.permitType
    if (parsed.data.permitNumber !== undefined) updateData.permitNumber = parsed.data.permitNumber
    if (parsed.data.issuingCountry !== undefined) updateData.issuingCountry = parsed.data.issuingCountry
    if (parsed.data.issuingAuthority !== undefined) updateData.issuingAuthority = parsed.data.issuingAuthority
    if (parsed.data.issueDate !== undefined) updateData.issueDate = new Date(parsed.data.issueDate)
    if (parsed.data.expiryDate !== undefined) {
      updateData.expiryDate = parsed.data.expiryDate ? new Date(parsed.data.expiryDate) : null
    }
    if (parsed.data.status !== undefined) updateData.status = parsed.data.status
    if (parsed.data.documentKey !== undefined) updateData.documentKey = parsed.data.documentKey
    if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes

    try {
      const updated = await prisma.workPermit.update({
        where: { id },
        data: updateData,
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'workPermit.update',
        resourceType: 'workPermit',
        resourceId: id,
        companyId: permit.companyId,
        ip,
        userAgent,
      })

      return apiSuccess(updated)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.EMPLOYEES, ACTION.UPDATE),
)

// ─── DELETE /api/v1/work-permits/[id] (soft delete) ───────

export const DELETE = withPermission(
  async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id } = await context.params

    const permit = await findWorkPermit(id, user)
    if (!permit) throw notFound('Work Permit을 찾을 수 없습니다.')

    try {
      await prisma.workPermit.update({
        where: { id },
        data: { deletedAt: new Date() },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'workPermit.delete',
        resourceType: 'workPermit',
        resourceId: id,
        companyId: permit.companyId,
        ip,
        userAgent,
      })

      return apiSuccess({ id })
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.EMPLOYEES, ACTION.DELETE),
)
