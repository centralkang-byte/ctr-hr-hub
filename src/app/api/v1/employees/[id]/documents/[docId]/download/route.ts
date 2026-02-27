// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/employees/[id]/documents/[docId]/download
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { getPresignedDownloadUrl } from '@/lib/s3'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/employees/[id]/documents/[docId]/download ─

export const GET = withPermission(
  async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id, docId } = await context.params

    const doc = await prisma.employeeDocument.findFirst({
      where: { id: docId, employeeId: id, deletedAt: null },
    })

    if (!doc) {
      throw notFound('문서를 찾을 수 없습니다.')
    }

    const url = await getPresignedDownloadUrl(doc.fileKey)

    const { ip, userAgent } = extractRequestMeta(req.headers)
    logAudit({
      actorId: user.employeeId,
      action: 'employee.document.download',
      resourceType: 'employee_document',
      resourceId: doc.id,
      companyId: doc.companyId,
      ip,
      userAgent,
    })

    return apiSuccess({ url })
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)
