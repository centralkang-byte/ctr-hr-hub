// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/positions?companyId=X&departmentId=Y
// Returns positions filtered by company and optionally department
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { withPermission, perm } from '@/lib/permissions'
import { apiSuccess } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { MODULE, ACTION } from '@/lib/constants'

export const GET = withPermission(
  async (req: NextRequest) => {
    const { searchParams } = new URL(req.url)
    const companyId = searchParams.get('companyId')
    const departmentId = searchParams.get('departmentId')

    const where: Record<string, unknown> = { isActive: true }
    if (companyId) where.companyId = companyId
    if (departmentId) where.departmentId = departmentId

    const positions = await prisma.position.findMany({
      where,
      select: {
        id: true,
        titleKo: true,
        titleEn: true,
        code: true,
        companyId: true,
        departmentId: true,
      },
      orderBy: { titleKo: 'asc' },
    })

    // Map to common {id, name} format for dropdown compatibility
    const mapped = positions.map((p) => ({
      id: p.id,
      name: p.titleKo,
      nameEn: p.titleEn,
      code: p.code,
      companyId: p.companyId,
      departmentId: p.departmentId,
    }))

    return apiSuccess(mapped)
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)
