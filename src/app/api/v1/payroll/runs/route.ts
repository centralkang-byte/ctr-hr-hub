// ═══════════════════════════════════════════════════════════
// GET /api/v1/payroll/runs — 급여 실행 목록
// POST /api/v1/payroll/runs — 급여 실행 생성 (DRAFT)
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { payrollRunListSchema, payrollRunCreateSchema } from '@/lib/schemas/payroll'
import type { Prisma } from '@/generated/prisma/client'

export const GET = withPermission(
  async (req, _context, user) => {
    const url = new URL(req.url)
    const params = Object.fromEntries(url.searchParams)
    const { page, limit, status, runType, yearMonth } = payrollRunListSchema.parse(params)

    const where: Prisma.PayrollRunWhereInput = {
      companyId: user.companyId,
      ...(status && { status }),
      ...(runType && { runType }),
      ...(yearMonth && { yearMonth }),
    }

    const [data, total] = await Promise.all([
      prisma.payrollRun.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          approver: { select: { id: true, name: true } },
          _count: { select: { payrollItems: true } },
        },
      }),
      prisma.payrollRun.count({ where }),
    ])

    return apiPaginated(data, buildPagination(page, limit, total))
  },
  perm(MODULE.PAYROLL, ACTION.VIEW),
)

export const POST = withPermission(
  async (req, _context, user) => {
    const body = await req.json()
    const data = payrollRunCreateSchema.parse(body)

    const run = await prisma.payrollRun.create({
      data: {
        companyId: user.companyId,
        name: data.name,
        runType: data.runType,
        yearMonth: data.yearMonth,
        periodStart: new Date(data.periodStart),
        periodEnd: new Date(data.periodEnd),
        payDate: data.payDate ? new Date(data.payDate) : null,
        currency: data.currency,
        status: 'DRAFT',
      },
    })

    const { ip, userAgent } = extractRequestMeta(req.headers)
    logAudit({
      actorId: user.employeeId,
      action: 'PAYROLL_RUN_CREATE',
      resourceType: 'PayrollRun',
      resourceId: run.id,
      companyId: user.companyId,
      changes: { name: data.name, runType: data.runType, yearMonth: data.yearMonth },
      ip,
      userAgent,
    })

    return apiSuccess(run, 201)
  },
  perm(MODULE.PAYROLL, ACTION.CREATE),
)
