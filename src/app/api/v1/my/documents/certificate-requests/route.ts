// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/my/documents/certificate-requests
// 본인 증명서 발급 요청 목록
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withAuth } from '@/lib/permissions'
import type { SessionUser } from '@/types'

export const GET = withAuth(
  async (_req: NextRequest, _context, user: SessionUser) => {
    const requests = await prisma.certificateRequest.findMany({
      where: { employeeId: user.employeeId },
      include: {
        approver: { select: { id: true, name: true } },
      },
      orderBy: { requestedAt: 'desc' },
    })

    return apiSuccess(requests)
  },
)
