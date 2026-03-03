// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 개인 리스크 상세 조회 + 실시간 계산 API
// GET /api/v1/analytics/employee-risk?employee_id=xxx
// ═══════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculateTurnoverRisk } from '@/lib/analytics/predictive/turnoverRisk'
import { calculateBurnoutScore } from '@/lib/analytics/predictive/burnout'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as { role?: string; companyId?: string }
  if (!['HR_ADMIN', 'SUPER_ADMIN'].includes(user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const employeeId = searchParams.get('employee_id') ?? ''
  const companyId = searchParams.get('company_id') ?? user.companyId ?? ''
  const recalculate = searchParams.get('recalculate') === 'true'

  if (!employeeId) return NextResponse.json({ error: 'employee_id required' }, { status: 400 })

  try {
    // 직원 기본 정보
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        name: true,
        hireDate: true,
        assignments: {
          where: { isPrimary: true, endDate: null },
          take: 1,
          select: {
            department: { select: { id: true, name: true } },
            jobGrade: { select: { name: true } },
            company: { select: { id: true, name: true } },
          },
        },
      },
    })
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

    const effectiveCompanyId = employee.assignments[0]?.company?.id ?? companyId

    // 최신 스코어 조회 또는 재계산
    let turnoverScore = await prisma.turnoverRiskScore.findFirst({
      where: { employeeId },
      orderBy: { calculatedAt: 'desc' },
    })

    let burnoutScore = await prisma.burnoutScore.findFirst({
      where: { employeeId },
      orderBy: { calculatedAt: 'desc' },
    })

    if (recalculate || !turnoverScore) {
      const result = await calculateTurnoverRisk(employeeId, effectiveCompanyId)
      if (result.riskLevel !== 'insufficient_data') {
        turnoverScore = await prisma.turnoverRiskScore.create({
          data: {
            employeeId,
            overallScore: result.overallScore,
            riskLevel: result.riskLevel,
            signals: result.signals as object,
            topFactors: result.topFactors,
          },
        })
      }
    }

    if (recalculate || !burnoutScore) {
      const result = await calculateBurnoutScore(employeeId, effectiveCompanyId)
      burnoutScore = await prisma.burnoutScore.create({
        data: {
          employeeId,
          overallScore: result.overallScore,
          riskLevel: result.riskLevel,
          indicators: result.indicators as object,
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        employee: {
          id: employee.id,
          name: employee.name,
          hireDate: employee.hireDate,
          department: employee.assignments[0]?.department ?? null,
          jobGrade: employee.assignments[0]?.jobGrade ?? null,
          company: employee.assignments[0]?.company ?? null,
        },
        turnover: turnoverScore,
        burnout: burnoutScore,
      },
    })
  } catch (error) {
    console.error('[employee-risk GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
