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
      const results = await prisma.$transaction(async (tx) => {
        const created: Array<{
          employeeId: string
          previousSalary: number
          newSalary: number
          changePct: number
        }> = []

        for (const adj of adjustments) {
          // Get employee's current salary from latest CompensationHistory
          const latestComp = await tx.compensationHistory.findFirst({
            where: { employeeId: adj.employeeId, companyId },
            orderBy: { effectiveDate: 'desc' },
          })
          const previousBaseSalary = latestComp
            ? Number(latestComp.newBaseSalary)
            : 0

          // Get employee's salary band for compa-ratio
          const employee = await tx.employee.findUnique({
            where: { id: adj.employeeId },
            select: { jobGradeId: true },
          })

          let compaRatio: number | null = null
          if (employee?.jobGradeId) {
            const band = await tx.salaryBand.findFirst({
              where: {
                companyId,
                jobGradeId: employee.jobGradeId,
                deletedAt: null,
              },
              orderBy: { effectiveFrom: 'desc' },
            })
            if (band) {
              compaRatio = calculateCompaRatio(
                adj.newBaseSalary,
                Number(band.midSalary),
              )
            }
          }

          // Get emsBlock from latest evaluation for this cycle
          const evaluation = await tx.performanceEvaluation.findFirst({
            where: { employeeId: adj.employeeId, cycleId },
          })

          // Create CompensationHistory record
          await tx.compensationHistory.create({
            data: {
              employeeId: adj.employeeId,
              companyId,
              changeType: adj.changeType ?? 'ANNUAL_INCREASE',
              previousBaseSalary,
              newBaseSalary: adj.newBaseSalary,
              currency: latestComp?.currency ?? 'KRW',
              changePct: adj.changePct,
              effectiveDate: new Date(effectiveDate),
              reason: adj.reason ?? null,
              approvedBy: user.employeeId,
              emsBlockAtTime: evaluation?.emsBlock ?? null,
              compaRatio,
            },
          })

          created.push({
            employeeId: adj.employeeId,
            previousSalary: previousBaseSalary,
            newSalary: adj.newBaseSalary,
            changePct: adj.changePct,
          })
        }

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
