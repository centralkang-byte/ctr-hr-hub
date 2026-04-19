// ═══════════════════════════════════════════════════════════
// GET /api/v1/payroll/runs — 급여 실행 목록
// POST /api/v1/payroll/runs — 급여 실행 생성 (DRAFT)
// ═══════════════════════════════════════════════════════════

// import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { payrollRunListSchema, payrollRunCreateSchema } from '@/lib/schemas/payroll'
import { injectLoaAdjustmentsForNewRun } from '@/lib/loa/payroll-adjustment'
import type { Prisma } from '@/generated/prisma/client'

export const GET = withPermission(
  async (req, _context, user) => {
    const url = new URL(req.url)
    const params = Object.fromEntries(url.searchParams)
    const parsedQuery = payrollRunListSchema.safeParse(params)
    if (!parsedQuery.success) {
      throw badRequest('잘못된 파라미터입니다.')
    }
    const { page, limit, status, runType, yearMonth } = parsedQuery.data

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
    let body: unknown
    try {
      body = await req.json()
    } catch {
      throw badRequest('요청 본문이 올바른 JSON 형식이 아닙니다.')
    }
    const parsed = payrollRunCreateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.')
    }
    const data = parsed.data

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

    // LOA Phase 3: PayrollRun 생성 시 ACTIVE LOA adjustment 자동 주입 (fire-and-forget)
    injectLoaAdjustmentsForNewRun(run.id, user.companyId, data.yearMonth).catch((err) => {
      console.error('[LOA Phase 3] PayrollRun 생성 시 LOA adjustment 자동 주입 실패:', err)
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
