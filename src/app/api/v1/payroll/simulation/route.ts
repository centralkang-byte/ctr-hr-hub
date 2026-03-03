// ═══════════════════════════════════════════════════════════
// GET  /api/v1/payroll/simulation?employeeId=X — 시뮬레이션 이력
// POST /api/v1/payroll/simulation               — 시뮬레이션 실행
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermission } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess, apiError } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { z } from 'zod'

const simulateSchema = z.object({
  type: z.enum(['transfer', 'raise', 'promotion']),
  title: z.string().min(1),
  employeeId: z.string(),
  parameters: z.record(z.string(), z.unknown()),
})

// ─── 시뮬레이션 계산 엔진 ────────────────────────────────────

async function simulateTransfer(employeeId: string, params: Record<string, unknown>) {
  // 전출: 현재 법인 → 대상 법인 급여 체계로 환산
  const targetCompanyId = params.targetCompanyId as string
  const effectiveDate = params.effectiveDate as string ?? new Date().toISOString()

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: {
      assignments: { where: { isPrimary: true, endDate: null }, take: 1, include: { company: true, jobGrade: true } },
      payrollItems: { orderBy: { createdAt: 'desc' }, take: 1, include: { run: true } },
    },
  })
  if (!employee) throw new Error('직원을 찾을 수 없습니다.')

  const currentAssignment = employee.assignments[0]
  const latestPayroll = employee.payrollItems[0]
  const currentGross = Number(latestPayroll?.grossPay ?? 0)

  // 대상 법인 같은 직급의 평균 급여
  const targetCompany = await prisma.company.findUnique({ where: { id: targetCompanyId }, select: { name: true, code: true, currency: true } })

  const targetGradeAvg = await prisma.payrollItem.aggregate({
    where: {
      run: { companyId: targetCompanyId },
      employee: {
        assignments: {
          some: {
            jobGradeId: currentAssignment?.jobGradeId ?? undefined,
            isPrimary: true,
            endDate: null,
          },
        },
      },
    },
    _avg: { grossPay: true },
  })

  const targetAvgLocal = Number(targetGradeAvg._avg?.grossPay ?? 0)

  // 현재 급여 KRW 환산
  const now = new Date()
  const currentRate = await prisma.exchangeRate.findFirst({
    where: { year: now.getFullYear(), month: now.getMonth() + 1, fromCurrency: currentAssignment?.company?.currency ?? 'KRW', toCurrency: 'KRW' },
  })
  const targetRate = await prisma.exchangeRate.findFirst({
    where: { year: now.getFullYear(), month: now.getMonth() + 1, fromCurrency: targetCompany?.currency ?? 'KRW', toCurrency: 'KRW' },
  })

  const currentGrossKRW = currentGross * Number(currentRate?.rate ?? 1)
  const targetAvgKRW = targetAvgLocal * Number(targetRate?.rate ?? 1)
  const delta = targetAvgKRW - currentGrossKRW
  const deltaPercent = currentGrossKRW > 0 ? (delta / currentGrossKRW) * 100 : 0

  return {
    currentCompany: currentAssignment?.company?.name ?? '—',
    currentCurrency: currentAssignment?.company?.currency ?? 'KRW',
    currentGrossLocal: currentGross,
    currentGrossKRW,
    targetCompany: targetCompany?.name ?? '—',
    targetCurrency: targetCompany?.currency ?? 'USD',
    targetAvgLocal,
    targetAvgKRW,
    deltaKRW: delta,
    deltaPercent,
    effectiveDate,
    note: `${currentAssignment?.company?.code} → ${targetCompany?.code} 전출 시 인당 연간 추가 비용: ₩${Math.abs(Math.round(delta * 12)).toLocaleString()}`,
  }
}

async function simulateRaise(employeeId: string, params: Record<string, unknown>) {
  const raisePercent = Number(params.raisePercent ?? 0)
  const effectiveDate = params.effectiveDate as string ?? new Date().toISOString()

  const latestItem = await prisma.payrollItem.findFirst({
    where: { employeeId },
    orderBy: { createdAt: 'desc' },
    include: { run: { include: { company: true } } },
  })
  if (!latestItem) throw new Error('급여 데이터 없음')

  const current = {
    basePay: Number(latestItem.baseSalary ?? 0),
    grossPay: Number(latestItem.grossPay ?? 0),
    netPay: Number(latestItem.netPay ?? 0),
    currency: latestItem.run.currency ?? 'KRW',
  }

  const after = {
    basePay: current.basePay * (1 + raisePercent / 100),
    grossPay: current.grossPay * (1 + raisePercent / 100),
    netPay: current.netPay * (1 + raisePercent / 100),
  }

  const now = new Date()
  const rate = await prisma.exchangeRate.findFirst({
    where: { year: now.getFullYear(), month: now.getMonth() + 1, fromCurrency: current.currency, toCurrency: 'KRW' },
  })
  const rateVal = Number(rate?.rate ?? 1)

  return {
    raisePercent,
    effectiveDate,
    currency: current.currency,
    before: current,
    after,
    monthlyDeltaLocal: after.grossPay - current.grossPay,
    monthlyDeltaKRW: (after.grossPay - current.grossPay) * rateVal,
    annualDeltaKRW: (after.grossPay - current.grossPay) * rateVal * 12,
    note: `연 ${raisePercent}% 인상 시 연간 추가 비용: ₩${Math.round((after.grossPay - current.grossPay) * rateVal * 12).toLocaleString()}`,
  }
}

async function simulatePromotion(employeeId: string, params: Record<string, unknown>) {
  const targetGradeId = params.targetGradeId as string
  const effectiveDate = params.effectiveDate as string ?? new Date().toISOString()

  const [employee, targetGrade] = await Promise.all([
    prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        assignments: { where: { isPrimary: true, endDate: null }, take: 1, include: { jobGrade: true, company: true } },
        payrollItems: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    }),
    prisma.jobGrade.findUnique({ where: { id: targetGradeId } }),
  ])
  if (!employee) throw new Error('직원을 찾을 수 없습니다.')

  const currentAssignment = employee.assignments[0]
  const currentGrade = currentAssignment?.jobGrade
  const currentGrossLocal = Number(employee.payrollItems[0]?.grossPay ?? 0)

  // 대상 직급 평균 급여 (같은 법인)
  const targetAvg = await prisma.payrollItem.aggregate({
    where: {
      run: { companyId: currentAssignment?.companyId ?? '' },
      employee: {
        assignments: {
          some: { jobGradeId: targetGradeId, isPrimary: true, endDate: null },
        },
      },
    },
    _avg: { grossPay: true },
  })
  const targetAvgLocal = Number(targetAvg._avg?.grossPay ?? 0)

  const now = new Date()
  const rate = await prisma.exchangeRate.findFirst({
    where: { year: now.getFullYear(), month: now.getMonth() + 1, fromCurrency: currentAssignment?.company?.currency ?? 'KRW', toCurrency: 'KRW' },
  })
  const rateVal = Number(rate?.rate ?? 1)

  const deltaLocal = targetAvgLocal - currentGrossLocal
  const deltaKRW = deltaLocal * rateVal

  return {
    effectiveDate,
    currentGrade: currentGrade?.name ?? '—',
    targetGrade: targetGrade?.name ?? '—',
    currency: currentAssignment?.company?.currency ?? 'KRW',
    currentGrossLocal,
    targetAvgLocal,
    deltaLocal,
    deltaKRW,
    annualDeltaKRW: deltaKRW * 12,
    note: `${currentGrade?.name} → ${targetGrade?.name} 승진 시 예상 연봉 인상: ₩${Math.round(deltaKRW * 12).toLocaleString()}`,
  }
}

// ─── Route handlers ────────────────────────────────────────

export const GET = withPermission(
  async (req: NextRequest) => {
    const employeeId = new URL(req.url).searchParams.get('employeeId')
    const simulations = await prisma.payrollSimulation.findMany({
      where: employeeId ? { employeeId } : undefined,
      include: { employee: { select: { name: true, employeeNo: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
    return apiSuccess(simulations)
  },
  { module: MODULE.PAYROLL, action: ACTION.VIEW }
)

export const POST = withPermission(
  async (req: NextRequest, _ctx, user) => {
    const body = await req.json()
    const { type, title, employeeId, parameters } = simulateSchema.parse(body)

    let results: Record<string, unknown>
    const params = parameters as Record<string, unknown>

    try {
      if (type === 'transfer') results = await simulateTransfer(employeeId, params)
      else if (type === 'raise') results = await simulateRaise(employeeId, params)
      else results = await simulatePromotion(employeeId, params)
    } catch (e: unknown) {
      return apiError(badRequest(e instanceof Error ? e.message : '시뮬레이션 실패'))
    }

    const sim = await prisma.payrollSimulation.create({
      data: {
        id: crypto.randomUUID(),
        createdBy: user.id,
        type,
        title,
        employeeId,
        parameters: JSON.parse(JSON.stringify(parameters)),
        results: JSON.parse(JSON.stringify(results)),
      },
    })

    return apiSuccess({ ...sim, results }, 201)
  },
  { module: MODULE.PAYROLL, action: ACTION.CREATE }
)
