// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 개인 리스크 상세 조회 + 실시간 계산 API
// GET /api/v1/analytics/employee-risk?employee_id=xxx
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { apiSuccess } from '@/lib/api'
import { badRequest, forbidden, notFound } from '@/lib/errors'
import { MODULE, ACTION } from '@/lib/constants'
import { calculateTurnoverRisk } from '@/lib/analytics/predictive/turnoverRisk'
import { calculateBurnoutScore } from '@/lib/analytics/predictive/burnout'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const employeeId = searchParams.get('employee_id') ?? ''
    const recalculate = searchParams.get('recalculate') === 'true'

    if (!employeeId) throw badRequest('employee_id required')

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
    if (!employee) throw notFound('Employee not found')

    const effectiveCompanyId = employee.assignments[0]?.company?.id ?? user.companyId

    // M-1: 법인 간 IDOR 차단 — SUPER_ADMIN만 타 법인 직원 조회 가능
    if (user.role !== 'SUPER_ADMIN' && effectiveCompanyId !== user.companyId) {
      throw forbidden()
    }

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

    return apiSuccess({
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
    })
  },
  perm(MODULE.ANALYTICS, ACTION.VIEW),
)
