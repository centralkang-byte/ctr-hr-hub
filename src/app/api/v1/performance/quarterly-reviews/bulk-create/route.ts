// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Quarterly Review Bulk Create
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, forbidden } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { getDirectReportIds, resolveManagerIds } from '@/lib/employee/direct-reports'
import { getHrAdminIds } from '@/lib/auth/hr-admin-lookup'
import { batchProcess } from '@/lib/api/batchProcess'
import type { SessionUser } from '@/types'

// ─── Validation ─────────────────────────────────────────────

const bulkCreateSchema = z.object({
  employeeIds: z.array(z.string().uuid()).min(1).max(500),
  year: z.number().int(),
  quarter: z.enum(['Q1', 'Q2', 'Q3', 'Q4']),
  cycleId: z.string().uuid().optional(),
})

// ─── POST /api/v1/performance/quarterly-reviews/bulk-create ──
// Bulk-create quarterly reviews for multiple employees.

export const POST = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    const body = bulkCreateSchema.parse(await req.json())
    const { employeeIds, year, quarter, cycleId } = body

    // 1. Verify all employees belong to user's company (via assignment)
    const validEmployees = await prisma.employee.findMany({
      where: {
        id: { in: employeeIds },
        assignments: {
          some: { isPrimary: true, endDate: null, position: { companyId: user.companyId } },
        },
      },
      select: { id: true },
    })
    const validIds = new Set(validEmployees.map((e) => e.id))
    const invalidIds = employeeIds.filter((eid) => !validIds.has(eid))
    if (invalidIds.length > 0) {
      throw badRequest('일부 직원이 소속 회사에 존재하지 않습니다.', { invalidIds })
    }

    // 2. Manager scope check
    if (user.role === ROLE.MANAGER) {
      const directReportIds = await getDirectReportIds(user.employeeId)
      const directSet = new Set(directReportIds)
      const unauthorized = employeeIds.filter((eid) => !directSet.has(eid))
      if (unauthorized.length > 0) {
        throw forbidden('직속 부하 직원에 대해서만 리뷰를 생성할 수 있습니다.')
      }
    }

    // 3. Find existing reviews to skip duplicates
    const existing = await prisma.quarterlyReview.findMany({
      where: { year, quarter, companyId: user.companyId },
      select: { employeeId: true },
    })
    const skipSet = new Set(existing.map((r) => r.employeeId))
    const newEmployeeIds = employeeIds.filter((eid) => !skipSet.has(eid))

    if (newEmployeeIds.length === 0) {
      return apiSuccess({ created: 0, skipped: employeeIds.length, total: employeeIds.length })
    }

    // 4. Batch resolve managers
    const managerMap = await resolveManagerIds(newEmployeeIds)

    // 5. Fallback: HR admin for employees without a manager
    const noManagerIds = newEmployeeIds.filter((eid) => !managerMap.has(eid))
    let hrFallbackId: string | null = null
    if (noManagerIds.length > 0) {
      const hrAdminIds = await getHrAdminIds(prisma, user.companyId)
      hrFallbackId = hrAdminIds[0] ?? null
    }

    // Build final list with manager assignments
    const reviewInputs: Array<{ employeeId: string; managerId: string }> = []
    for (const eid of newEmployeeIds) {
      const managerId = managerMap.get(eid) ?? hrFallbackId
      if (!managerId) continue // Skip if no manager and no HR fallback
      reviewInputs.push({ employeeId: eid, managerId })
    }

    // 6. Batch fetch MBO goals (APPROVED) for snapshot
    const goals = await prisma.mboGoal.findMany({
      where: {
        employeeId: { in: reviewInputs.map((r) => r.employeeId) },
        status: 'APPROVED',
        companyId: user.companyId,
      },
      select: { id: true, employeeId: true, title: true, weight: true },
    })
    const goalsByEmployee = new Map<string, typeof goals>()
    for (const g of goals) {
      const arr = goalsByEmployee.get(g.employeeId) ?? []
      arr.push(g)
      goalsByEmployee.set(g.employeeId, arr)
    }

    // 7. Batch create reviews + goal progress snapshots
    let created = 0
    await batchProcess(
      reviewInputs,
      async (chunk) => {
        await prisma.$transaction(async (tx) => {
          for (const input of chunk) {
            const review = await tx.quarterlyReview.create({
              data: {
                employeeId: input.employeeId,
                managerId: input.managerId,
                companyId: user.companyId,
                year,
                quarter,
                status: 'IN_PROGRESS',
                ...(cycleId ? { cycleId } : {}),
              },
            })

            const empGoals = goalsByEmployee.get(input.employeeId) ?? []
            if (empGoals.length > 0) {
              await tx.quarterlyGoalProgress.createMany({
                data: empGoals.map((g) => ({
                  quarterlyReviewId: review.id,
                  goalId: g.id,
                  progressPct: 0,
                })),
              })
            }

            created++
          }
        })
        return chunk // batchProcess expects R[] return
      },
      50,
    )

    const skipped = employeeIds.length - created

    const { ip, userAgent } = extractRequestMeta(req.headers)
    logAudit({
      actorId: user.employeeId,
      action: 'performance.quarterly-review.bulk-create',
      resourceType: 'quarterlyReview',
      resourceId: `${year}-${quarter}`,
      companyId: user.companyId,
      changes: { created, skipped, total: employeeIds.length, year, quarter },
      ip,
      userAgent,
    })

    return apiSuccess({ created, skipped, total: employeeIds.length })
  },
  perm(MODULE.PERFORMANCE, ACTION.CREATE),
)
