// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GDPR Request Detail & Update
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { gdprRequestUpdateSchema } from '@/lib/schemas/compliance'
import { generateDataExport, anonymizeEmployeeData } from '@/lib/compliance/gdpr'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (_req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const request = await prisma.gdprRequest.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        employee: { select: { id: true, name: true, employeeNo: true, email: true } },
        completedBy: { select: { id: true, name: true } },
      },
    })
    if (!request) throw badRequest('Request not found')
    return apiSuccess(request)
  },
  perm(MODULE.COMPLIANCE, ACTION.VIEW),
)

export const PUT = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const body: unknown = await req.json()
    const parsed = gdprRequestUpdateSchema.safeParse(body)
    if (!parsed.success) throw badRequest('Invalid request data', { issues: parsed.error.issues })

    const existing = await prisma.gdprRequest.findFirst({
      where: { id, companyId: user.companyId },
    })
    if (!existing) throw badRequest('Request not found')

    try {
      // Auto-process for certain request types when completing
      if (parsed.data.status === 'COMPLETED') {
        if (existing.requestType === 'PORTABILITY') {
          const exportData = await generateDataExport(existing.employeeId)
          if (exportData) {
            // Store export reference in response note
            parsed.data.responseNote = parsed.data.responseNote
              ? `${parsed.data.responseNote}\n[Data export generated]`
              : '[Data export generated]'
          }
        } else if (existing.requestType === 'ERASURE') {
          await anonymizeEmployeeData(existing.employeeId)
        }
      }

      const updated = await prisma.gdprRequest.update({
        where: { id },
        data: {
          status: parsed.data.status,
          responseNote: parsed.data.responseNote,
          ...(parsed.data.status === 'COMPLETED' ? {
            completedAt: new Date(),
            completedById: user.employeeId,
          } : {}),
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'compliance.gdpr.request.update',
        resourceType: 'gdprRequest',
        resourceId: id,
        companyId: user.companyId,
        changes: { status: parsed.data.status },
        ip,
        userAgent,
      })

      return apiSuccess(updated)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.COMPLIANCE, ACTION.UPDATE),
)
