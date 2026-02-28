// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/attrition/employees/[id]
// 개별 직원 이직 위험도 상세: 최신 점수 + 요인 + 이력 + AI 보정
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { attritionRiskAssessment } from '@/lib/claude'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id: employeeId } = await context.params
    const includeAi = req.nextUrl.searchParams.get('includeAi') === 'true'

    // ── Verify employee exists and belongs to user's company ─
    const employee = await prisma.employee.findFirst({
      where: {
        id: employeeId,
        deletedAt: null,
        ...(user.role !== 'SUPER_ADMIN' ? { companyId: user.companyId } : {}),
      },
      select: {
        id: true,
        name: true,
        nameEn: true,
        email: true,
        hireDate: true,
        status: true,
        companyId: true,
        jobGradeId: true,
        jobCategoryId: true,
        department: { select: { id: true, name: true } },
        jobGrade: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true } },
      },
    })

    if (!employee) {
      throw notFound('직원을 찾을 수 없습니다.')
    }

    // ── Latest risk score ─────────────────────────────────
    const latestRisk = await prisma.attritionRiskHistory.findFirst({
      where: { employeeId },
      orderBy: { calculatedAt: 'desc' },
      select: {
        id: true,
        score: true,
        ruleScore: true,
        aiAdjustment: true,
        scoreFactors: true,
        calculatedAt: true,
      },
    })

    // ── Risk history (last 6 months) for trend line ───────
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const history = await prisma.attritionRiskHistory.findMany({
      where: {
        employeeId,
        calculatedAt: { gte: sixMonthsAgo },
      },
      orderBy: { calculatedAt: 'asc' },
      select: {
        score: true,
        ruleScore: true,
        aiAdjustment: true,
        scoreFactors: true,
        calculatedAt: true,
      },
    })

    // ── Determine risk level ──────────────────────────────
    const score = latestRisk?.score ?? 0
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    if (score >= 80) riskLevel = 'CRITICAL'
    else if (score >= 60) riskLevel = 'HIGH'
    else if (score >= 40) riskLevel = 'MEDIUM'
    else riskLevel = 'LOW'

    // ── AI Assessment (only for HIGH/CRITICAL and when requested) ──
    let aiAssessment = null

    if (includeAi && (riskLevel === 'HIGH' || riskLevel === 'CRITICAL') && latestRisk) {
      const factors = latestRisk.scoreFactors as Array<{
        factor: string
        value: number
      }> | null

      const factorScores: Record<string, number> = {}
      if (Array.isArray(factors)) {
        for (const f of factors) {
          factorScores[f.factor] = f.value
        }
      }

      // Get compa-ratio
      const latestComp = await prisma.compensationHistory.findFirst({
        where: { employeeId },
        orderBy: { effectiveDate: 'desc' },
        select: { newBaseSalary: true },
      })

      const salaryBand = await prisma.salaryBand.findFirst({
        where: {
          companyId: employee.companyId,
          jobGradeId: employee.jobGradeId,
          ...(employee.jobCategoryId ? { jobCategoryId: employee.jobCategoryId } : {}),
          deletedAt: null,
        },
        orderBy: { effectiveFrom: 'desc' },
        select: { midSalary: true },
      })

      const currentSalary = latestComp ? Number(latestComp.newBaseSalary) : 0
      const midSalary = salaryBand ? Number(salaryBand.midSalary) : 0
      const compaRatio = midSalary > 0 ? currentSalary / midSalary : 1.0

      // Get EMS block
      const latestEval = await prisma.performanceEvaluation.findFirst({
        where: { employeeId, status: 'SUBMITTED' },
        orderBy: { createdAt: 'desc' },
        select: { emsBlock: true },
      })

      const now = new Date()
      const tenureMonths =
        (now.getFullYear() - employee.hireDate.getFullYear()) * 12 +
        (now.getMonth() - employee.hireDate.getMonth())

      try {
        aiAssessment = await attritionRiskAssessment(
          {
            employeeName: employee.name,
            department: employee.department?.name ?? '-',
            grade: employee.jobGrade?.name ?? '-',
            tenureMonths,
            factorScores,
            totalScore: score,
            compaRatio,
            emsBlock: latestEval?.emsBlock ?? null,
          },
          employee.companyId,
          employeeId,
        )
      } catch {
        // AI failure should not break the response
        aiAssessment = null
      }
    }

    return apiSuccess({
      employee: {
        ...employee,
        riskScore: score,
        riskLevel,
      },
      latestAssessment: latestRisk
        ? {
            score: latestRisk.score,
            ruleScore: latestRisk.ruleScore,
            aiAdjustment: latestRisk.aiAdjustment,
            factors: latestRisk.scoreFactors,
            calculatedAt: latestRisk.calculatedAt,
          }
        : null,
      aiAssessment,
      history: history.map((h) => ({
        score: h.score,
        ruleScore: h.ruleScore,
        aiAdjustment: h.aiAdjustment,
        factors: h.scoreFactors,
        calculatedAt: h.calculatedAt,
      })),
    })
  },
  perm(MODULE.ANALYTICS, ACTION.VIEW),
)
