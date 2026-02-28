// ═══════════════════════════════════════════════════════════
// GET /api/v1/payroll/runs/[id] — 급여 실행 상세
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { notFound } from '@/lib/errors'

export const GET = withPermission(
  async (_req, context, user) => {
    const { id } = await context.params

    const run = await prisma.payrollRun.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        approver: { select: { id: true, name: true } },
        payrollItems: {
          include: {
            employee: {
              select: {
                id: true,
                name: true,
                employeeNo: true,
                department: { select: { id: true, name: true } },
                jobGrade: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { employee: { name: 'asc' } },
        },
      },
    })

    if (!run) throw notFound('급여 실행을 찾을 수 없습니다.')

    return apiSuccess(run)
  },
  perm(MODULE.PAYROLL, ACTION.VIEW),
)
