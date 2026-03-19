// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Compensation Confirm (Batch Apply)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { compensationConfirmSchema } from '@/lib/schemas/compensation'
import { calculateCompaRatio } from '@/lib/compensation'
import type { SessionUser } from '@/types'

// ─── POST /api/v1/compensation/confirm ───────────────────
// Batch-confirm compensation adjustments in a transaction

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = compensationConfirmSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { cycleId, effectiveDate, adjustments } = parsed.data
    const companyId = user.companyId
    const { ip, userAgent } = extractRequestMeta(req.headers)

    try {
      const employeeIds = adjustments.map((a) => a.employeeId)

      // 배치 프리페치로 N+1 제거
      const [latestComps, employees, evaluations] = await Promise.all([
        // 각 직원의 최신 보상 이력 (최신순)
        prisma.compensationHistory.findMany({
          where: { employeeId: { in: employeeIds }, companyId },
          orderBy: { effectiveDate: 'desc' },
          select: { employeeId: true, newBaseSalary: true, currency: true, effectiveDate: true },
        }),
        // 직급 정보
        prisma.employee.findMany({
          where: { id: { in: employeeIds } },
          select: {
            id: true,
            assignments: {
              where: { isPrimary: true, endDate: null },
              take: 1,
              select: { jobGradeId: true },
            },
          },
        }),
        // 성과 평가 (cycleId 기준)
        prisma.performanceEvaluation.findMany({
          where: { employeeId: { in: employeeIds }, cycleId },
          select: { employeeId: true, emsBlock: true },
        }),
      ])

      // 최신 보상 이력 Map (employeeId → latest)
      const latestCompMap = new Map<string, { newBaseSalary: unknown; currency: string }>()
      for (const comp of latestComps) {
        if (!latestCompMap.has(comp.employeeId)) {
          latestCompMap.set(comp.employeeId, comp)
        }
      }

      // 직급 Map
      const jobGradeMap = new Map<string, string>()
      for (const emp of employees) {
        const jgId = emp.assignments?.[0]?.jobGradeId
        if (jgId) jobGradeMap.set(emp.id, jgId)
      }

      // 성과 평가 Map
      const evalMap = new Map<string, string | null>()
      for (const e of evaluations) {
        if (!evalMap.has(e.employeeId)) evalMap.set(e.employeeId, e.emsBlock)
      }

      // 직급별 급여 밴드 배치 조회
      const uniqueJobGradeIds = [...new Set(jobGradeMap.values())]
      const salaryBands = uniqueJobGradeIds.length > 0
        ? await prisma.salaryBand.findMany({
            where: { companyId, jobGradeId: { in: uniqueJobGradeIds }, deletedAt: null },
            orderBy: { effectiveFrom: 'desc' },
            select: { jobGradeId: true, midSalary: true },
          })
        : []

      // 가장 최신 밴드 Map (jobGradeId → midSalary)
      const bandMap = new Map<string, number>()
      for (const band of salaryBands) {
        if (!bandMap.has(band.jobGradeId)) bandMap.set(band.jobGradeId, Number(band.midSalary))
      }

      const effectiveDateObj = new Date(effectiveDate)
      const results = await prisma.$transaction(async (tx) => {
        const created: Array<{
          employeeId: string
          previousSalary: number
          newSalary: number
          changePct: number
        }> = []

        const historyData = adjustments.map((adj) => {
          const latestComp = latestCompMap.get(adj.employeeId)
          const previousBaseSalary = latestComp ? Number(latestComp.newBaseSalary) : 0
          const jobGradeId = jobGradeMap.get(adj.employeeId)
          const midSalary = jobGradeId ? bandMap.get(jobGradeId) : undefined
          const compaRatio = midSalary != null
            ? calculateCompaRatio(adj.newBaseSalary, midSalary)
            : null
          const emsBlock = evalMap.get(adj.employeeId) ?? null

          created.push({
            employeeId: adj.employeeId,
            previousSalary: previousBaseSalary,
            newSalary: adj.newBaseSalary,
            changePct: adj.changePct,
          })

          return {
            employeeId: adj.employeeId,
            companyId,
            changeType: adj.changeType ?? 'ANNUAL_INCREASE',
            previousBaseSalary,
            newBaseSalary: adj.newBaseSalary,
            currency: (latestComp?.currency as string) ?? 'KRW',
            changePct: adj.changePct,
            effectiveDate: effectiveDateObj,
            reason: adj.reason ?? null,
            approvedBy: user.employeeId,
            emsBlockAtTime: emsBlock,
            compaRatio,
          }
        })

        await tx.compensationHistory.createMany({ data: historyData })
        return created
      })

      // Audit log for each adjustment (fire-and-forget, outside transaction)
      for (const item of results) {
        logAudit({
          actorId: user.employeeId,
          action: 'compensation.confirm',
          resourceType: 'compensationHistory',
          resourceId: item.employeeId,
          companyId,
          sensitivityLevel: 'HIGH',
          changes: {
            cycleId,
            previousSalary: item.previousSalary,
            newSalary: item.newSalary,
            changePct: item.changePct,
          },
          ip,
          userAgent,
        })
      }

      const totalIncrease = results.reduce(
        (sum, r) => sum + (r.newSalary - r.previousSalary),
        0,
      )

      return apiSuccess({
        confirmed: results.length,
        totalIncrease,
      })
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.COMPENSATION, ACTION.APPROVE),
)
