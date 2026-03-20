// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 번아웃 스코어 목록 조회 API
// GET /api/v1/analytics/burnout
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { apiSuccess } from '@/lib/api'
import { resolveCompanyId } from '@/lib/api/companyFilter'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'

export const GET = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const companyId = resolveCompanyId(user, searchParams.get('company_id'))
    const riskLevelFilter = searchParams.get('risk_level') ?? undefined

    const employees = await prisma.employee.findMany({
      where: {
        assignments: {
          some: { companyId, isPrimary: true, endDate: null, status: 'ACTIVE' },
        },
      },
      select: {
        id: true,
        name: true,
        assignments: {
          where: { isPrimary: true, endDate: null },
          take: 1,
          select: {
            department: { select: { name: true } },
          },
        },
        burnoutScores: {
          orderBy: { calculatedAt: 'desc' },
          take: 1,
          select: {
            id: true,
            overallScore: true,
            riskLevel: true,
            calculatedAt: true,
          },
        },
      },
    })

    const data = employees
      .map((e) => ({
        employeeId: e.id,
        employeeName: e.name,
        departmentName: extractPrimaryAssignment(e.assignments)?.department?.name ?? null,
        latestScore: e.burnoutScores[0] ?? null,
      }))
      .filter((d) => {
        if (!d.latestScore) return false
        if (riskLevelFilter && d.latestScore.riskLevel !== riskLevelFilter) return false
        return true
      })
      .sort((a, b) => (b.latestScore?.overallScore ?? 0) - (a.latestScore?.overallScore ?? 0))

    return apiSuccess(data)
  },
  perm(MODULE.ANALYTICS, ACTION.VIEW),
)
