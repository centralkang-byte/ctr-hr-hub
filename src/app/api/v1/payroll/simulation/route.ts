// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Payroll Simulation API (Enhanced)
// GET  /api/v1/payroll/simulation         — 시뮬레이션 이력
// POST /api/v1/payroll/simulation         — SINGLE / BULK 시뮬레이션
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermission } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess, apiError } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { resolveCompanyId } from '@/lib/api/companyFilter'
import { z } from 'zod'
import { calculateDeductionsByCountry } from '@/lib/payroll/globalDeductions'
import type { SimulationDeductions } from '@/lib/payroll/globalDeductions'

// ─── Validation Schemas ──────────────────────────────────

// Settings-connected: simulation parameter constraints (defaults below)
const MAX_ADJUST_RATE = 0.50 // 50% cap
const MAX_OVERTIME_HOURS = 52 // weekly limit

const singleParamsSchema = z.object({
  baseSalaryOverride: z.number().min(0).optional(),
  baseSalaryAdjustRate: z.number().min(-MAX_ADJUST_RATE).max(MAX_ADJUST_RATE).optional(),
  overtimeHours: z.number().min(0).max(MAX_OVERTIME_HOURS).optional(),
  nightHours: z.number().min(0).max(MAX_OVERTIME_HOURS).optional(),
  holidayHours: z.number().min(0).max(MAX_OVERTIME_HOURS).optional(),
  bonusAmount: z.number().min(0).optional(),
  allowanceChanges: z.object({
    meal: z.number().optional(),
    transport: z.number().optional(),
    other: z.number().optional(),
  }).optional(),
})

const bulkTargetSchema = z.object({
  type: z.enum(['COMPANY', 'DEPARTMENT', 'SELECTED']),
  companyId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  employeeIds: z.array(z.string().uuid()).optional(),
})

const bulkParamsSchema = z.object({
  baseSalaryAdjustRate: z.number().min(-MAX_ADJUST_RATE).max(MAX_ADJUST_RATE),
  bonusMonths: z.number().min(0).max(12).optional(),
  effectiveDate: z.string().optional(),
})

const simulateBodySchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('SINGLE'),
    employeeId: z.string().uuid(),
    parameters: singleParamsSchema,
  }),
  z.object({
    mode: z.literal('BULK'),
    target: bulkTargetSchema,
    parameters: bulkParamsSchema,
  }),
])

// ─── Helper Types ────────────────────────────────────────

interface PayDetail {
  baseSalary: number
  overtimePay: number
  nightPay: number
  holidayPay: number
  mealAllowance: number
  transportAllowance: number
  otherAllowance: number
  bonusAmount: number
  grossPay: number
  nationalPension: number
  healthInsurance: number
  longTermCare: number
  employmentInsurance: number
  incomeTax: number
  localIncomeTax: number
  totalDeductions: number
  netPay: number
}

interface EmployeeSimResult {
  id: string
  name: string
  employeeNo: string
  department: string
  position: string
  companyCode: string
  current: PayDetail
  simulated: PayDetail
  difference: {
    baseSalary: number
    grossPay: number
    totalDeductions: number
    netPay: number
  }
}

// ─── Core calculation (per employee) ─────────────────────

function computePayDetail(
  baseSalary: number,
  overtimePay: number,
  nightPay: number,
  holidayPay: number,
  mealAllowance: number,
  transportAllowance: number,
  otherAllowance: number,
  bonusAmount: number,
  companyCode: string,
): PayDetail {
  const grossPay = baseSalary + overtimePay + nightPay + holidayPay
    + mealAllowance + transportAllowance + otherAllowance + bonusAmount

  const deductions: SimulationDeductions = calculateDeductionsByCountry(companyCode, grossPay)

  return {
    baseSalary,
    overtimePay,
    nightPay,
    holidayPay,
    mealAllowance,
    transportAllowance,
    otherAllowance,
    bonusAmount,
    grossPay,
    nationalPension: deductions.nationalPension,
    healthInsurance: deductions.healthInsurance,
    longTermCare: deductions.longTermCare,
    employmentInsurance: deductions.employmentInsurance,
    incomeTax: deductions.incomeTax,
    localIncomeTax: deductions.localIncomeTax,
    totalDeductions: deductions.totalDeductions,
    netPay: grossPay - deductions.totalDeductions,
  }
}

// ─── Fetch employee data for simulation ──────────────────

interface EmployeeData {
  id: string
  name: string
  employeeNo: string
  department: string
  position: string
  companyCode: string
  companyId: string
  currentBaseSalary: number
  currentOvertimePay: number
  currentNightPay: number
  currentHolidayPay: number
  currentMealAllowance: number
  currentTransportAllowance: number
  currentOtherAllowance: number
  currentBonusAmount: number
}

async function fetchEmployeeData(employeeIds: string[]): Promise<EmployeeData[]> {
  if (employeeIds.length === 0) return []

  const employees = await prisma.employee.findMany({
    where: {
      id: { in: employeeIds },
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      employeeNo: true,
      assignments: {
        where: { isPrimary: true, endDate: null },
        take: 1,
        select: {
          companyId: true,
          department: { select: { name: true } },
          position: { select: { titleKo: true } },
          company: { select: { code: true } },
        },
      },
    },
  })

  // Latest compensation history for each employee
  const compensations = await prisma.compensationHistory.findMany({
    where: { employeeId: { in: employeeIds } },
    orderBy: { effectiveDate: 'desc' },
    distinct: ['employeeId'],
    select: { employeeId: true, newBaseSalary: true },
  })
  const salaryMap = new Map(
    compensations.map((c) => [c.employeeId, Number(c.newBaseSalary)])
  )

  // Fallback: latest contract salary for employees without compensation history
  const missingIds = employeeIds.filter((id) => !salaryMap.has(id))
  if (missingIds.length > 0) {
    const contracts = await prisma.contractHistory.findMany({
      where: { employeeId: { in: missingIds }, salaryAmount: { not: null } },
      orderBy: { startDate: 'desc' },
      distinct: ['employeeId'],
      select: { employeeId: true, salaryAmount: true },
    })
    for (const c of contracts) {
      if (c.salaryAmount) salaryMap.set(c.employeeId, Number(c.salaryAmount))
    }
  }

  // Latest payroll items for current earnings breakdown
  const latestPayrollItems = await prisma.payrollItem.findMany({
    where: { employeeId: { in: employeeIds } },
    orderBy: { createdAt: 'desc' },
    distinct: ['employeeId'],
    select: {
      employeeId: true,
      baseSalary: true,
      overtimePay: true,
      bonus: true,
      allowances: true,
      detail: true,
    },
  })
  const payrollMap = new Map(
    latestPayrollItems.map((p) => [p.employeeId, p])
  )

  return employees.map((emp) => {
    const asgn = emp.assignments?.[0]
    const annualSalary = salaryMap.get(emp.id) ?? 0
    const monthlySalary = Math.round(annualSalary / 12)
    const payrollItem = payrollMap.get(emp.id)
    const detail = payrollItem?.detail as Record<string, unknown> | null
    const earnings = (detail?.earnings ?? {}) as Record<string, number>

    return {
      id: emp.id,
      name: emp.name,
      employeeNo: emp.employeeNo,
      department: asgn?.department?.name ?? '',
      position: asgn?.position?.titleKo ?? '',
      companyCode: asgn?.company?.code ?? '',
      companyId: asgn?.companyId ?? '',
      currentBaseSalary: monthlySalary || Number(payrollItem?.baseSalary ?? 0),
      currentOvertimePay: earnings.overtimePay ?? Number(payrollItem?.overtimePay ?? 0),
      currentNightPay: earnings.nightShiftPay ?? 0,
      currentHolidayPay: earnings.holidayPay ?? 0,
      currentMealAllowance: earnings.mealAllowance ?? 0,
      currentTransportAllowance: earnings.transportAllowance ?? 0,
      currentOtherAllowance: earnings.otherEarnings ?? 0,
      currentBonusAmount: earnings.bonuses ?? Number(payrollItem?.bonus ?? 0),
    }
  })
}

// ─── Build simulation result for one employee ────────────

function simulateEmployee(
  emp: EmployeeData,
  params: {
    baseSalaryOverride?: number
    baseSalaryAdjustRate?: number
    overtimeHours?: number
    nightHours?: number
    holidayHours?: number
    bonusAmount?: number
    bonusMonths?: number
    allowanceChanges?: { meal?: number; transport?: number; other?: number }
  },
): EmployeeSimResult {
  // Current pay
  const current = computePayDetail(
    emp.currentBaseSalary,
    emp.currentOvertimePay,
    emp.currentNightPay,
    emp.currentHolidayPay,
    emp.currentMealAllowance,
    emp.currentTransportAllowance,
    emp.currentOtherAllowance,
    emp.currentBonusAmount,
    emp.companyCode,
  )

  // Simulated base salary
  let simBaseSalary = emp.currentBaseSalary
  if (params.baseSalaryOverride !== undefined) {
    simBaseSalary = params.baseSalaryOverride
  } else if (params.baseSalaryAdjustRate !== undefined) {
    simBaseSalary = Math.round(emp.currentBaseSalary * (1 + params.baseSalaryAdjustRate))
  }

  // Simulated overtime (use provided hours or keep current)
  // Settings-connected: hourly wage calculation basis (default: 209시간) — statutory monthly working hours for KR
  const hourlyWage = Math.round(simBaseSalary / 209)
  const simOvertimePay = params.overtimeHours !== undefined
    ? Math.round(hourlyWage * 1.5 * params.overtimeHours)
    : emp.currentOvertimePay
  const simNightPay = params.nightHours !== undefined
    ? Math.round(hourlyWage * 0.5 * params.nightHours)
    : emp.currentNightPay
  const simHolidayPay = params.holidayHours !== undefined
    ? Math.round(hourlyWage * 2.0 * params.holidayHours)
    : emp.currentHolidayPay

  // Bonus
  let simBonus = emp.currentBonusAmount
  if (params.bonusAmount !== undefined) {
    simBonus = params.bonusAmount
  } else if (params.bonusMonths !== undefined) {
    simBonus = Math.round(simBaseSalary * params.bonusMonths)
  }

  // Allowances
  const simMeal = params.allowanceChanges?.meal ?? emp.currentMealAllowance
  const simTransport = params.allowanceChanges?.transport ?? emp.currentTransportAllowance
  const simOther = params.allowanceChanges?.other ?? emp.currentOtherAllowance

  const simulated = computePayDetail(
    simBaseSalary,
    simOvertimePay,
    simNightPay,
    simHolidayPay,
    simMeal,
    simTransport,
    simOther,
    simBonus,
    emp.companyCode,
  )

  return {
    id: emp.id,
    name: emp.name,
    employeeNo: emp.employeeNo,
    department: emp.department,
    position: emp.position,
    companyCode: emp.companyCode,
    current,
    simulated,
    difference: {
      baseSalary: simulated.baseSalary - current.baseSalary,
      grossPay: simulated.grossPay - current.grossPay,
      totalDeductions: simulated.totalDeductions - current.totalDeductions,
      netPay: simulated.netPay - current.netPay,
    },
  }
}

// ─── Build summary from results ──────────────────────────

function buildSummary(
  mode: 'SINGLE' | 'BULK',
  parameters: Record<string, unknown>,
  results: EmployeeSimResult[],
) {
  const totals = {
    currentGross: 0,
    simulatedGross: 0,
    grossDifference: 0,
    grossChangeRate: 0,
    currentNet: 0,
    simulatedNet: 0,
    netDifference: 0,
    netChangeRate: 0,
    currentTotalDeductions: 0,
    simulatedTotalDeductions: 0,
  }

  for (const r of results) {
    totals.currentGross += r.current.grossPay
    totals.simulatedGross += r.simulated.grossPay
    totals.currentNet += r.current.netPay
    totals.simulatedNet += r.simulated.netPay
    totals.currentTotalDeductions += r.current.totalDeductions
    totals.simulatedTotalDeductions += r.simulated.totalDeductions
  }

  totals.grossDifference = totals.simulatedGross - totals.currentGross
  totals.grossChangeRate = totals.currentGross > 0
    ? Math.round((totals.grossDifference / totals.currentGross) * 10000) / 10000
    : 0
  totals.netDifference = totals.simulatedNet - totals.currentNet
  totals.netChangeRate = totals.currentNet > 0
    ? Math.round((totals.netDifference / totals.currentNet) * 10000) / 10000
    : 0

  // Department breakdown (bulk only)
  const byDepartment = mode === 'BULK'
    ? Object.values(
      results.reduce<Record<string, {
        department: string
        employeeCount: number
        currentGross: number
        simulatedGross: number
        difference: number
      }>>((acc, r) => {
        const dept = r.department || '(미배정)'
        if (!acc[dept]) {
          acc[dept] = { department: dept, employeeCount: 0, currentGross: 0, simulatedGross: 0, difference: 0 }
        }
        acc[dept].employeeCount++
        acc[dept].currentGross += r.current.grossPay
        acc[dept].simulatedGross += r.simulated.grossPay
        acc[dept].difference += r.simulated.grossPay - r.current.grossPay
        return acc
      }, {}),
    )
    : undefined

  return {
    simulatedAt: new Date().toISOString(),
    mode,
    employeeCount: results.length,
    parameters,
    totals,
    ...(byDepartment ? { byDepartment } : {}),
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
  { module: MODULE.PAYROLL, action: ACTION.VIEW },
)

export const POST = withPermission(
  async (req: NextRequest, _ctx, user) => {
    const body = await req.json()
    const parsed = simulateBodySchema.safeParse(body)

    if (!parsed.success) {
      return apiError(badRequest('잘못된 요청 파라미터입니다.', {
        issues: parsed.error.issues.map((e) => e.message),
      }))
    }

    const input = parsed.data

    try {
      if (input.mode === 'SINGLE') {
        // ── SINGLE mode ───────────────────────────────
        const empData = await fetchEmployeeData([input.employeeId])

        if (empData.length === 0) {
          return apiError(badRequest('직원을 찾을 수 없습니다.'))
        }

        const result = simulateEmployee(empData[0], input.parameters)
        const summary = buildSummary('SINGLE', input.parameters as unknown as Record<string, unknown>, [result])

        return apiSuccess({
          summary,
          employees: [result],
        })
      } else {
        // ── BULK mode ─────────────────────────────────
        const { target, parameters } = input

        // Resolve target employee IDs
        let employeeIds: string[] = []

        if (target.type === 'SELECTED' && target.employeeIds?.length) {
          employeeIds = target.employeeIds
        } else {
          const companyId = target.companyId
            ? resolveCompanyId(user, target.companyId)
            : user.companyId

          const assignmentWhere: Record<string, unknown> = {
            isPrimary: true,
            endDate: null,
            status: 'ACTIVE',
            companyId,
          }

          if (target.type === 'DEPARTMENT' && target.departmentId) {
            assignmentWhere.departmentId = target.departmentId
          }

          const assignments = await prisma.employeeAssignment.findMany({
            where: assignmentWhere,
            select: { employeeId: true },
            take: 500, // Safety limit
          })

          employeeIds = assignments.map((a) => a.employeeId)
        }

        if (employeeIds.length === 0) {
          return apiError(badRequest('대상 직원이 없습니다.'))
        }

        const empDataList = await fetchEmployeeData(employeeIds)
        const results = empDataList.map((emp) =>
          simulateEmployee(emp, {
            baseSalaryAdjustRate: parameters.baseSalaryAdjustRate,
            bonusMonths: parameters.bonusMonths,
          }),
        )

        const summary = buildSummary('BULK', parameters as unknown as Record<string, unknown>, results)

        return apiSuccess({
          summary,
          employees: results,
        })
      }
    } catch (e: unknown) {
      return apiError(badRequest(e instanceof Error ? e.message : '시뮬레이션 실패'))
    }
  },
  { module: MODULE.PAYROLL, action: ACTION.CREATE },
)
