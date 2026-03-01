// ═══════════════════════════════════════════════════════════
// CTR HR Hub — China Compliance Utilities
// 五险一金 (Social Insurance + Housing Fund) calculations
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
type Decimal = Prisma.Decimal
const { Decimal } = Prisma

// ─── Types ────────────────────────────────────────────────

export interface SocialInsuranceConfig {
  insuranceType: string
  city: string
  employerRate: Decimal | number
  employeeRate: Decimal | number
  baseMin: Decimal | number
  baseMax: Decimal | number
}

export interface InsuranceCalculationResult {
  insuranceType: string
  baseSalary: number
  employerAmount: number
  employeeAmount: number
  employerRate: number
  employeeRate: number
}

export interface SocialInsuranceCalculation {
  employeeId: string
  baseSalary: number
  results: InsuranceCalculationResult[]
  totalEmployerAmount: number
  totalEmployeeAmount: number
}

export interface SocialInsuranceReportRow {
  insuranceType: string
  employeeCount: number
  totalBaseSalary: number
  totalEmployerAmount: number
  totalEmployeeAmount: number
}

export interface SocialInsuranceReport {
  companyId: string
  year: number
  month: number
  rows: SocialInsuranceReportRow[]
  grandTotalEmployer: number
  grandTotalEmployee: number
  generatedAt: string
}

export interface EmployeeRegistryRow {
  employeeNo: string
  name: string
  nameEn: string | null
  gender: string | null
  birthDate: string | null
  hireDate: string
  department: string
  jobGrade: string
  employmentType: string
  status: string
  email: string
}

export interface EmployeeRegistry {
  companyId: string
  totalCount: number
  rows: EmployeeRegistryRow[]
  generatedAt: string
}

// ─── Social Insurance Calculation ─────────────────────────

/**
 * Calculate all 6 types of social insurance (五险一金) amounts
 * for a given salary and set of configs.
 *
 * The base salary is clamped between baseMin and baseMax per config.
 */
export function calculateSocialInsurance(
  salary: number,
  configs: SocialInsuranceConfig[],
): InsuranceCalculationResult[] {
  return configs.map((config) => {
    const baseMin = Number(config.baseMin)
    const baseMax = Number(config.baseMax)
    const employerRate = Number(config.employerRate)
    const employeeRate = Number(config.employeeRate)

    // Clamp base salary within the allowed range
    const baseSalary = Math.min(Math.max(salary, baseMin), baseMax)

    // Calculate amounts using Decimal for precision then round to 2 decimal places
    const employerDecimal = new Decimal(baseSalary)
      .mul(new Decimal(employerRate).div(100))
    const employeeDecimal = new Decimal(baseSalary)
      .mul(new Decimal(employeeRate).div(100))

    return {
      insuranceType: config.insuranceType,
      baseSalary: Number(new Decimal(baseSalary).toFixed(2)),
      employerAmount: Number(employerDecimal.toFixed(2)),
      employeeAmount: Number(employeeDecimal.toFixed(2)),
      employerRate,
      employeeRate,
    }
  })
}

// ─── Monthly Insurance Report ──────────────────────────────

/**
 * Generate monthly social insurance report data for a company.
 * Aggregates SocialInsuranceRecord data by insurance type.
 */
export async function generateSocialInsuranceReport(
  companyId: string,
  year: number,
  month: number,
): Promise<SocialInsuranceReport> {
  const records = await prisma.socialInsuranceRecord.findMany({
    where: { companyId, year, month },
    select: {
      insuranceType: true,
      baseSalary: true,
      employerAmount: true,
      employeeAmount: true,
    },
  })

  // Aggregate by insurance type
  const aggregation: Record<string, {
    employeeCount: number
    totalBaseSalary: Decimal
    totalEmployerAmount: Decimal
    totalEmployeeAmount: Decimal
  }> = {}

  for (const record of records) {
    const key = record.insuranceType
    if (!aggregation[key]) {
      aggregation[key] = {
        employeeCount: 0,
        totalBaseSalary: new Decimal(0),
        totalEmployerAmount: new Decimal(0),
        totalEmployeeAmount: new Decimal(0),
      }
    }
    aggregation[key].employeeCount += 1
    aggregation[key].totalBaseSalary = aggregation[key].totalBaseSalary.add(record.baseSalary)
    aggregation[key].totalEmployerAmount = aggregation[key].totalEmployerAmount.add(record.employerAmount)
    aggregation[key].totalEmployeeAmount = aggregation[key].totalEmployeeAmount.add(record.employeeAmount)
  }

  const rows: SocialInsuranceReportRow[] = Object.entries(aggregation).map(
    ([insuranceType, agg]) => ({
      insuranceType,
      employeeCount: agg.employeeCount,
      totalBaseSalary: Number(agg.totalBaseSalary.toFixed(2)),
      totalEmployerAmount: Number(agg.totalEmployerAmount.toFixed(2)),
      totalEmployeeAmount: Number(agg.totalEmployeeAmount.toFixed(2)),
    }),
  )

  const grandTotalEmployer = rows.reduce((sum, r) => sum + r.totalEmployerAmount, 0)
  const grandTotalEmployee = rows.reduce((sum, r) => sum + r.totalEmployeeAmount, 0)

  return {
    companyId,
    year,
    month,
    rows,
    grandTotalEmployer: Number(new Decimal(grandTotalEmployer).toFixed(2)),
    grandTotalEmployee: Number(new Decimal(grandTotalEmployee).toFixed(2)),
    generatedAt: new Date().toISOString(),
  }
}

// ─── Employee Registry (花名册) ──────────────────────────────

/**
 * Generate employee registry (花名册) data for a company.
 * Returns all active employees with key HR information.
 */
export async function generateEmployeeRegistry(
  companyId: string,
): Promise<EmployeeRegistry> {
  const employees = await prisma.employee.findMany({
    where: {
      companyId,
      status: { not: 'RESIGNED' },
    },
    select: {
      employeeNo: true,
      name: true,
      nameEn: true,
      gender: true,
      birthDate: true,
      hireDate: true,
      employmentType: true,
      status: true,
      email: true,
      department: { select: { name: true } },
      jobGrade: { select: { name: true } },
    },
    orderBy: [{ department: { name: 'asc' } }, { name: 'asc' }],
  })

  const rows: EmployeeRegistryRow[] = employees.map((emp) => ({
    employeeNo: emp.employeeNo,
    name: emp.name,
    nameEn: emp.nameEn ?? null,
    gender: emp.gender ?? null,
    birthDate: emp.birthDate ? emp.birthDate.toISOString().split('T')[0] : null,
    hireDate: emp.hireDate.toISOString().split('T')[0],
    department: emp.department.name,
    jobGrade: emp.jobGrade.name,
    employmentType: emp.employmentType,
    status: emp.status,
    email: emp.email,
  }))

  return {
    companyId,
    totalCount: rows.length,
    rows,
    generatedAt: new Date().toISOString(),
  }
}
