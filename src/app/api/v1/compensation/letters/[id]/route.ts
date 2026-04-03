// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Compensation Letter Download
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound, forbidden, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { getPresignedDownloadUrl } from '@/lib/s3'
import type { SessionUser } from '@/types'
import type { NextRequest } from 'next/server'

// ─── GET /api/v1/compensation/letters/[id] ──────────────
// 단건 다운로드 URL 반환

export const GET = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    const { id } = await (context as { params: Promise<{ id: string }> }).params

    try {
      const letter = await prisma.compensationLetter.findUnique({
        where: { id },
        select: {
          id: true,
          companyId: true,
          s3Key: true,
          filename: true,
          version: true,
          status: true,
          invalidatedAt: true,
          employee: { select: { name: true, employeeNo: true } },
        },
      })

      if (!letter) throw notFound('통보서를 찾을 수 없습니다.')
      if (letter.companyId !== user.companyId) throw forbidden('접근 권한이 없습니다.')

      const downloadUrl = await getPresignedDownloadUrl(letter.s3Key)
      const { ip, userAgent } = extractRequestMeta(req.headers)

      logAudit({
        actorId: user.employeeId,
        action: 'compensation.letter.download',
        resourceType: 'compensationLetter',
        resourceId: id,
        companyId: user.companyId,
        sensitivityLevel: 'HIGH',
        changes: { employeeName: letter.employee.name, version: letter.version },
        ip,
        userAgent,
      })

      return apiSuccess({
        downloadUrl,
        filename: letter.filename,
        version: letter.version,
        isInvalidated: letter.invalidatedAt !== null,
      })
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.COMPENSATION, ACTION.VIEW),
)
