// ═══════════════════════════════════════════════════════════
// CTR HR Hub — KEDO Document List & Create
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { kedoSearchSchema, kedoCreateSchema } from '@/lib/schemas/compliance'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/compliance/ru/kedo ─────────────────────
// Paginated list of KEDO documents with filters

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = kedoSearchSchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { page, limit, status, documentType, employeeId } = parsed.data
    const companyId = user.companyId

    const where = {
      companyId,
      ...(status ? { status } : {}),
      ...(documentType ? { documentType } : {}),
      ...(employeeId ? { employeeId } : {}),
    }

    const [documents, total] = await Promise.all([
      prisma.kedoDocument.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          employee: { select: { id: true, name: true, employeeNo: true } },
          signedBy: { select: { id: true, name: true } },
          rejectedBy: { select: { id: true, name: true } },
        },
      }),
      prisma.kedoDocument.count({ where }),
    ])

    return apiPaginated(documents, buildPagination(page, limit, total))
  },
  perm(MODULE.COMPLIANCE, ACTION.VIEW),
)

// ─── POST /api/v1/compliance/ru/kedo ────────────────────
// Create a new KEDO document

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = kedoCreateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { employeeId, documentType, title, content, signatureLevel, expiresAt } = parsed.data

    try {
      const document = await prisma.kedoDocument.create({
        data: {
          companyId: user.companyId,
          employeeId,
          documentType,
          title,
          content,
          signatureLevel,
          ...(expiresAt ? { expiresAt: new Date(expiresAt) } : {}),
        },
        include: {
          employee: { select: { id: true, name: true, employeeNo: true } },
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'compliance.ru.kedo.create',
        resourceType: 'kedoDocument',
        resourceId: document.id,
        companyId: user.companyId,
        changes: { employeeId, documentType, title },
        ip,
        userAgent,
      })

      return apiSuccess(document, 201)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.COMPLIANCE, ACTION.CREATE),
)
