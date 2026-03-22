// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/my/documents
// 본인 문서 목록 조회 (Employee Self-Service)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withAuth } from '@/lib/permissions'
import type { SessionUser } from '@/types'

export const GET = withAuth(
  async (_req: NextRequest, _context, user: SessionUser) => {
    const documents = await prisma.employeeDocument.findMany({
      where: { employeeId: user.employeeId, deletedAt: null },
      include: {
        uploader: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return apiSuccess(documents)
  },
)
