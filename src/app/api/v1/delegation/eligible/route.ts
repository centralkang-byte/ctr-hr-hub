// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Eligible Delegatees API
// GET /api/v1/delegation/eligible → 대결 가능 대상자 목록
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') ?? ''

    // 같은 법인의 MANAGER/HR_ADMIN/EXECUTIVE/SUPER_ADMIN 역할 직원 조회
    // 본인 제외
    const employees = await prisma.employee.findMany({
      where: {
        id: { not: user.employeeId },
        deletedAt: null,
        assignments: {
          some: {
            companyId: user.companyId,
            isPrimary: true,
            endDate: null,
            status: 'ACTIVE',
          },
        },
        employeeRoles: {
          some: {
            role: {
              code: { in: ['MANAGER', 'HR_ADMIN', 'EXECUTIVE', 'SUPER_ADMIN'] },
            },
          },
        },
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { email: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        assignments: {
          where: { isPrimary: true, endDate: null },
          take: 1,
          select: {
            department: { select: { name: true } },
            jobGrade: { select: { name: true } },
          },
        },
      },
      take: 20,
      orderBy: { name: 'asc' },
    })

    const result = employees.map((e) => ({
      id: e.id,
      name: e.name,
      email: e.email,
      department: e.assignments[0]?.department?.name ?? null,
      jobGrade: e.assignments[0]?.jobGrade?.name ?? null,
    }))

    return apiSuccess(result)
  },
  perm(MODULE.LEAVE, ACTION.VIEW),
)
