// ═══════════════════════════════════════════════════════════
// GET /api/v1/payroll/runs — 급여 실행 목록
// POST /api/v1/payroll/runs — 급여 실행 생성 (DRAFT)
// ═══════════════════════════════════════════════════════════

// import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { extractRequestMeta } from '@/lib/audit'
import { payrollRunListSchema, payrollRunCreateSchema } from '@/lib/schemas/payroll'
import { resolveCompanyFilter } from '@/lib/api/companyFilter'
import { createPayrollRunWithInitialLoaChildren } from '@/lib/payroll/run-service'
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

    // 멀티테넌트 스코프 (CEO S285 결정): SUPER = 전 법인 운영자 → 목록도 전 법인.
    // resolveCompanyFilter — SUPER는 ?companyId 지정 시 해당 법인, 미지정 시 전체({}).
    // 비-SUPER는 항상 본인 법인 강제(요청 파라미터 무시, fail-closed). companyId는
    // payrollRunListSchema에 없어(strip됨) searchParams에서 직접 읽는다.
    const where: Prisma.PayrollRunWhereInput = {
      ...resolveCompanyFilter(user, url.searchParams.get('companyId')),
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

    // 멀티테넌트 스코프 (CEO S285 결정): 목록/상세 read·기존 run write는 SUPER 전 법인이나,
    // run '생성'은 SUPER도 본인 법인 한정(타 법인 생성은 미개방 — 잘못된 법인 run 생성 위험 +
    // 생성 UI에 법인 선택기 없음). 비-SUPER는 당연히 본인 법인. 따라서 user.companyId 고정 유지.
    const { ip, userAgent } = extractRequestMeta(req.headers)
    let run
    try {
      run = await createPayrollRunWithInitialLoaChildren({
        input: {
          companyId: user.companyId,
          actorId: user.employeeId,
          name: data.name,
          runType: data.runType,
          yearMonth: data.yearMonth,
          periodStart: new Date(data.periodStart),
          periodEnd: new Date(data.periodEnd),
          payDate: data.payDate ? new Date(data.payDate) : null,
          currency: data.currency,
        },
        audit: {
          action: 'PAYROLL_RUN_CREATE',
          changes: { name: data.name, runType: data.runType, yearMonth: data.yearMonth },
          ip,
          userAgent,
        },
      })
    } catch (e) {
      throw handlePrismaError(e)
    }

    return apiSuccess(run, 201)
  },
  perm(MODULE.PAYROLL, ACTION.CREATE),
)
