// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 예측 애널리틱스 배치 계산 API
// POST /api/v1/analytics/calculate
// HR_ADMIN / SUPER_ADMIN 전용
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { apiSuccess } from '@/lib/api'
import { resolveCompanyId } from '@/lib/api/companyFilter'
import { badRequest } from '@/lib/errors'
import { MODULE, ACTION } from '@/lib/constants'
import { calculateTurnoverRisk } from '@/lib/analytics/predictive/turnoverRisk'
import { calculateBurnoutScore } from '@/lib/analytics/predictive/burnout'
import { calculateTeamHealth } from '@/lib/analytics/predictive/teamHealth'
import type { SessionUser } from '@/types'

const BATCH_SIZE = 50

async function batchAllSettled<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = []
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const chunk = items.slice(i, i + BATCH_SIZE)
    const chunkResults = await Promise.allSettled(chunk.map(fn))
    results.push(...chunkResults)
  }
  return results
}

export const POST = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    const body = await req.json().catch(() => ({}))
    const companyId = resolveCompanyId(user, body.company_id as string | undefined)
    if (!companyId) throw badRequest('company_id required')

    // 해당 법인 활성 직원 조회
    const employees = await prisma.employee.findMany({
      where: {
        assignments: {
          some: { companyId, isPrimary: true, endDate: null, status: 'ACTIVE' },
        },
      },
      select: { id: true },
    })

    const employeeIds = employees.map((e) => e.id)

    // 1. 이직 위험 일괄 계산 (50명씩 배치)
    const turnoverResults = await batchAllSettled(employeeIds, (id) =>
      calculateTurnoverRisk(id, companyId),
    )

    // 2. 번아웃 일괄 계산 (50명씩 배치)
    const burnoutResults = await batchAllSettled(employeeIds, (id) =>
      calculateBurnoutScore(id, companyId),
    )

    // 3. DB 저장 (이직 위험)
    const turnoverRows = turnoverResults
      .map((r, i) => ({ result: r, employeeId: employeeIds[i]! }))
      .filter((x) => x.result.status === 'fulfilled')
      .map(({ result, employeeId }) => {
        const v = (result as PromiseFulfilledResult<Awaited<ReturnType<typeof calculateTurnoverRisk>>>).value
        if (v.riskLevel === 'insufficient_data') return null
        return {
          employeeId,
          overallScore: v.overallScore,
          riskLevel: v.riskLevel,
          signals: v.signals as object,
          topFactors: v.topFactors,
        }
      })
      .filter(Boolean) as {
        employeeId: string
        overallScore: number
        riskLevel: string
        signals: object
        topFactors: string[]
      }[]

    if (turnoverRows.length > 0) {
      await prisma.turnoverRiskScore.createMany({ data: turnoverRows })
    }

    // 4. DB 저장 (번아웃)
    const burnoutRows = burnoutResults
      .map((r, i) => ({ result: r, employeeId: employeeIds[i]! }))
      .filter((x) => x.result.status === 'fulfilled')
      .map(({ result, employeeId }) => {
        const v = (result as PromiseFulfilledResult<Awaited<ReturnType<typeof calculateBurnoutScore>>>).value
        return {
          employeeId,
          overallScore: v.overallScore,
          riskLevel: v.riskLevel,
          indicators: v.indicators as object,
        }
      })

    if (burnoutRows.length > 0) {
      await prisma.burnoutScore.createMany({ data: burnoutRows })
    }

    // 5. 팀 건강 계산 (부서별)
    const departments = await prisma.department.findMany({
      where: { companyId },
      select: { id: true },
    })

    const teamHealthRows = (
      await Promise.allSettled(
        departments.map((d) => calculateTeamHealth(d.id, companyId)),
      )
    )
      .map((r, i) => ({ result: r, deptId: departments[i]!.id }))
      .filter((x) => x.result.status === 'fulfilled')
      .map(({ result, deptId }) => {
        const v = (result as PromiseFulfilledResult<Awaited<ReturnType<typeof calculateTeamHealth>>>).value
        return {
          departmentId: deptId,
          companyId,
          overallScore: v.overallScore,
          riskLevel: v.riskLevel,
          metrics: v.metrics as object,
          memberCount: v.memberCount,
        }
      })

    if (teamHealthRows.length > 0) {
      await prisma.teamHealthScore.createMany({ data: teamHealthRows })
    }

    // 6. 스냅샷 저장
    const snapshotDate = new Date()
    snapshotDate.setHours(0, 0, 0, 0)

    await prisma.analyticsSnapshot.upsert({
      where: { companyId_snapshotDate_type: { companyId, snapshotDate, type: 'predictive_summary' } },
      create: {
        companyId,
        snapshotDate,
        type: 'predictive_summary',
        data: {
          employeeCount: employeeIds.length,
          turnoverCalculated: turnoverRows.length,
          burnoutCalculated: burnoutRows.length,
          teamHealthCalculated: teamHealthRows.length,
          highRiskTurnover: turnoverRows.filter((r) => ['high', 'critical'].includes(r.riskLevel)).length,
          highRiskBurnout: burnoutRows.filter((r) => ['high', 'critical'].includes(r.riskLevel)).length,
        },
      },
      update: {
        data: {
          employeeCount: employeeIds.length,
          turnoverCalculated: turnoverRows.length,
          burnoutCalculated: burnoutRows.length,
          teamHealthCalculated: teamHealthRows.length,
          highRiskTurnover: turnoverRows.filter((r) => ['high', 'critical'].includes(r.riskLevel)).length,
          highRiskBurnout: burnoutRows.filter((r) => ['high', 'critical'].includes(r.riskLevel)).length,
        },
      },
    })

    return apiSuccess({
      processed: {
        employees: employeeIds.length,
        turnover: turnoverRows.length,
        burnout: burnoutRows.length,
        teamHealth: teamHealthRows.length,
      },
    })
  },
  perm(MODULE.ANALYTICS, ACTION.CREATE),
)
