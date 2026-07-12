// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 개인 리스크 상세 조회 + 실시간 계산 API
// GET /api/v1/analytics/employee-risk?employee_id=xxx
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { apiSuccess } from '@/lib/api'
import { badRequest, forbidden, notFound } from '@/lib/errors'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { calculateTurnoverRisk } from '@/lib/analytics/predictive/turnoverRisk'
import { calculateBurnoutScore } from '@/lib/analytics/predictive/burnout'
import type { SessionUser } from '@/types'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'

export const GET = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const employeeId = searchParams.get('employeeId') || searchParams.get('employee_id') || ''
    // VIEW 게이트 라우트지만 recalculate=true 분기는 점수를 생성(mutation)하므로
    // HR 이상만 허용 (런칭 감사 후속 — Codex G1 발견, S335)
    const recalculate = searchParams.get('recalculate') === 'true'
    if (recalculate && user.role !== ROLE.HR_ADMIN && user.role !== ROLE.SUPER_ADMIN) {
      throw forbidden('재계산은 HR 관리자만 실행할 수 있습니다.')
    }

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

    const primaryAsgn = extractPrimaryAssignment(employee.assignments)
    const effectiveCompanyId = primaryAsgn?.company?.id ?? user.companyId

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
        department: primaryAsgn?.department ?? null,
        jobGrade: primaryAsgn?.jobGrade ?? null,
        company: primaryAsgn?.company ?? null,
      },
      turnover: turnoverScore,
      burnout: burnoutScore,
    })
  },
  perm(MODULE.ANALYTICS, ACTION.VIEW),
)
