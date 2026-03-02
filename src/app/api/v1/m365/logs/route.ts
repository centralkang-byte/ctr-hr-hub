// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/m365/logs
// M365 프로비저닝 로그 조회
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiPaginated, buildPagination } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { m365LogListSchema } from '@/lib/schemas/m365'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/m365/logs ──────────────────────────────

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = m365LogListSchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { page, limit, actionType, employeeId } = parsed.data

    const companyFilter =
      user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

    const where = {
      ...companyFilter,
      ...(actionType ? { actionType } : {}),
      ...(employeeId ? { employeeId } : {}),
    }

    const [logs, total] = await Promise.all([
      prisma.m365ProvisioningLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { executedAt: 'desc' },
      }),
      prisma.m365ProvisioningLog.count({ where }),
    ])

    // Enrich with employee names
    const employeeIds = [...new Set(logs.map((l) => l.employeeId))]
    const employees = employeeIds.length > 0
      ? await prisma.employee.findMany({
          where: { id: { in: employeeIds } },
          select: { id: true, name: true, employeeNo: true },
        })
      : []

    const employeeMap = new Map(employees.map((e) => [e.id, e]))

    const enrichedLogs = logs.map((log) => {
      const emp = employeeMap.get(log.employeeId)
      return {
        ...log,
        employeeName: emp?.name ?? null,
        employeeNo: emp?.employeeNo ?? null,
      }
    })

    return apiPaginated(enrichedLogs, buildPagination(page, limit, total))
  },
  perm(MODULE.SETTINGS, ACTION.VIEW),
)
