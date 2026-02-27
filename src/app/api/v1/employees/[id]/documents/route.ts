// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET/POST /api/v1/employees/[id]/documents
// ═══════════════════════════════════════════════════════════

import { z } from 'zod'
import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound, badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

const documentCreateSchema = z.object({
  docType: z.enum(['CONTRACT', 'ID_CARD', 'CERTIFICATE', 'RESUME', 'HANDOVER', 'OTHER']),
  title: z.string().min(1).max(200),
  fileKey: z.string().min(1),
  fileSize: z.number().int().optional(),
  mimeType: z.string().optional(),
})

// ─── GET /api/v1/employees/[id]/documents ─────────────────

export const GET = withPermission(
  async (
    _req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id } = await context.params

    const companyFilter = user.role === 'SUPER_ADMIN' ? {} : { companyId: user.companyId }

    const documents = await prisma.employeeDocument.findMany({
      where: { employeeId: id, deletedAt: null, ...companyFilter },
      include: {
        uploader: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return apiSuccess(documents)
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)

// ─── POST /api/v1/employees/[id]/documents ────────────────

export const POST = withPermission(
  async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id } = await context.params

    const body: unknown = await req.json()
    const parsed = documentCreateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const companyFilter = user.role === 'SUPER_ADMIN' ? {} : { companyId: user.companyId }

    // Verify employee exists in the user's company and retrieve companyId
    const employee = await prisma.employee.findFirst({
      where: { id, deletedAt: null, ...companyFilter },
      select: { id: true, companyId: true },
    })

    if (!employee) {
      throw notFound('직원을 찾을 수 없습니다.')
    }

    try {
      const document = await prisma.employeeDocument.create({
        data: {
          employeeId: id,
          companyId: employee.companyId,
          docType: parsed.data.docType,
          title: parsed.data.title,
          fileKey: parsed.data.fileKey,
          fileSize: parsed.data.fileSize ?? null,
          mimeType: parsed.data.mimeType ?? null,
          uploadedBy: user.employeeId,
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'employee.document.upload',
        resourceType: 'employee_document',
        resourceId: document.id,
        companyId: employee.companyId,
        ip,
        userAgent,
      })

      return apiSuccess(document, 201)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.EMPLOYEES, ACTION.UPDATE),
)
