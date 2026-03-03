// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 이직 위험 스코어 목록 조회 API
// GET /api/v1/analytics/turnover-risk
// ═══════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as { role?: string; companyId?: string }
  if (!['HR_ADMIN', 'SUPER_ADMIN'].includes(user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const companyId = searchParams.get('company_id') ?? user.companyId ?? ''
  const riskLevelFilter = searchParams.get('risk_level') ?? undefined

  try {
    // 각 직원의 최신 스코어 조회 (calculatedAt 기준 정렬 후 take:1)
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
            jobGrade: { select: { name: true } },
          },
        },
        turnoverRiskScores: {
          orderBy: { calculatedAt: 'desc' },
          take: 1,
          select: {
            id: true,
            overallScore: true,
            riskLevel: true,
            topFactors: true,
            calculatedAt: true,
          },
        },
      },
    })

    const data = employees
      .map((e) => ({
        employeeId: e.id,
        employeeName: e.name,
        departmentName: e.assignments[0]?.department?.name ?? null,
        jobGradeName: e.assignments[0]?.jobGrade?.name ?? null,
        latestScore: e.turnoverRiskScores[0] ?? null,
      }))
      .filter((d) => {
        if (!d.latestScore) return false
        if (riskLevelFilter && d.latestScore.riskLevel !== riskLevelFilter) return false
        return true
      })
      .sort((a, b) => (b.latestScore?.overallScore ?? 0) - (a.latestScore?.overallScore ?? 0))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[turnover-risk GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
