// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/my/documents/[docId]/download
// 본인 문서 다운로드 (S3 presigned URL)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound, forbidden } from '@/lib/errors'
import { withAuth } from '@/lib/permissions'
import { getPresignedDownloadUrl } from '@/lib/s3'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import type { SessionUser } from '@/types'

export const GET = withAuth(
  async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { docId } = await context.params

    const doc = await prisma.employeeDocument.findFirst({
      where: { id: docId, deletedAt: null },
    })

    if (!doc) throw notFound('문서를 찾을 수 없습니다.')
    if (doc.employeeId !== user.employeeId) throw forbidden('본인 문서만 다운로드할 수 있습니다.')

    const url = await getPresignedDownloadUrl(doc.fileKey)

    const { ip, userAgent } = extractRequestMeta(req.headers)
    logAudit({
      actorId: user.employeeId,
      action: 'my.document.download',
      resourceType: 'employee_document',
      resourceId: doc.id,
      companyId: doc.companyId,
      ip,
      userAgent,
    })

    return apiSuccess({ url })
  },
)
