// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Korean Labor Law Compliance Utilities
// 52-hour monitoring, mandatory training status, severance calculation
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { krLaborModule } from '@/lib/labor/kr'

/**
 * Get weekly work hours summary for all employees in a company
 */
export async function getWeeklyWorkHoursSummary(companyId: string, weekStart: Date) {
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)

  const attendances = await prisma.attendance.findMany({
    where: {
      companyId,
      clockIn: { gte: weekStart, lt: weekEnd },
      clockOut: { not: null },
    },
    select: {
      employeeId: true,
      clockIn: true,
      clockOut: true,
      overtimeMinutes: true,
    },
  })

  const hoursByEmployee = new Map<string, number>()

  for (const a of attendances) {
    if (!a.clockOut) continue
    const hours = (a.clockOut.getTime() - a.clockIn!.getTime()) / (1000 * 60 * 60)
    hoursByEmployee.set(a.employeeId, (hoursByEmployee.get(a.employeeId) ?? 0) + hours)
  }

  let compliant = 0
  let warning = 0
  let violation = 0

  for (const [, hours] of hoursByEmployee) {
    const status = classifyWorkHoursStatus(hours)
    if (status === 'COMPLIANT') compliant++
    else if (status === 'WARNING') warning++
    else violation++
  }

  const totalEmployees = hoursByEmployee.size

  return {
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    totalEmployees,
    compliant,
    warning,
    violation,
    complianceRate: totalEmployees > 0 ? Math.round((compliant / totalEmployees) * 100) : 100,
  }
}

/**
 * Classify work hours status using Korean labor law (52-hour rule)
 */
export function classifyWorkHoursStatus(weeklyHours: number): 'COMPLIANT' | 'WARNING' | 'VIOLATION' {
  const validation = krLaborModule.validateWorkHours(weeklyHours)
  if (validation.isValid) {
    return weeklyHours > 48 ? 'WARNING' : 'COMPLIANT'
  }
  return 'VIOLATION'
}

/**
 * Get employee-level weekly work hours
 */
export async function getEmployeeWorkHours(companyId: string, weekStart: Date, page: number, limit: number) {
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)

  const employees = await prisma.employee.findMany({
    where: { companyId, status: 'ACTIVE', deletedAt: null },
    select: { id: true, name: true, employeeNo: true, departmentId: true },
    skip: (page - 1) * limit,
    take: limit,
  })

  const total = await prisma.employee.count({
    where: { companyId, status: 'ACTIVE', deletedAt: null },
  })

  const employeeIds = employees.map((e) => e.id)

  const attendances = await prisma.attendance.findMany({
    where: {
      companyId,
      employeeId: { in: employeeIds },
      clockIn: { gte: weekStart, lt: weekEnd },
      clockOut: { not: null },
    },
    select: { employeeId: true, clockIn: true, clockOut: true },
  })

  const hoursByEmployee = new Map<string, number>()
  for (const a of attendances) {
    if (!a.clockOut) continue
    const hours = (a.clockOut.getTime() - a.clockIn!.getTime()) / (1000 * 60 * 60)
    hoursByEmployee.set(a.employeeId, (hoursByEmployee.get(a.employeeId) ?? 0) + hours)
  }

  const data = employees.map((e) => {
    const hours = Math.round((hoursByEmployee.get(e.id) ?? 0) * 10) / 10
    return {
      ...e,
      weeklyHours: hours,
      status: classifyWorkHoursStatus(hours),
    }
  })

  return { data, total }
}

/**
 * Get mandatory training completion status for a company/year
 */
export async function getMandatoryTrainingStatus(companyId: string, year: number) {
  const trainings = await prisma.mandatoryTraining.findMany({
    where: { companyId, year, isActive: true },
    include: {
      course: {
        include: {
          enrollments: {
            where: {
              employee: { companyId, status: 'ACTIVE', deletedAt: null },
            },
            select: { employeeId: true, status: true, completedAt: true },
          },
        },
      },
    },
  })

  const totalActiveEmployees = await prisma.employee.count({
    where: { companyId, status: 'ACTIVE', deletedAt: null },
  })

  return trainings.map((mt) => {
    const completed = mt.course.enrollments.filter((e) => e.status === 'ENROLLMENT_COMPLETED').length
    const enrolled = mt.course.enrollments.length
    const completionRate = totalActiveEmployees > 0
      ? Math.round((completed / totalActiveEmployees) * 100)
      : 0

    return {
      id: mt.id,
      trainingType: mt.trainingType,
      courseTitle: mt.course.title,
      year: mt.year,
      dueDate: mt.dueDate,
      requiredHours: Number(mt.requiredHours),
      totalEmployees: totalActiveEmployees,
      enrolled,
      completed,
      completionRate,
      isOverdue: new Date() > mt.dueDate && completionRate < 100,
    }
  })
}

/**
 * Calculate severance interim payment amount
 */
export async function calculateSeveranceInterim(employeeId: string) {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      name: true,
      hireDate: true,
      compensationHistories: {
        orderBy: { effectiveDate: 'desc' },
        take: 1,
        select: { newBaseSalary: true },
      },
    },
  })
  if (!employee) return null

  const now = new Date()
  const yearsOfService = (now.getTime() - employee.hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25)

  if (yearsOfService < 1) {
    return { eligible: false, reason: '1년 미만 근속', yearsOfService: Math.round(yearsOfService * 10) / 10 }
  }

  const latestSalary = employee.compensationHistories[0]?.newBaseSalary
  const avgMonthly = latestSalary ? Number(latestSalary) / 12 : 0
  const avgDaily = avgMonthly / 30

  // 퇴직금 = (1일 평균임금 × 30일) × (근속연수)
  const severanceAmount = Math.round(avgDaily * 30 * yearsOfService)

  return {
    eligible: true,
    employeeId: employee.id,
    employeeName: employee.name,
    hireDate: employee.hireDate,
    yearsOfService: Math.round(yearsOfService * 10) / 10,
    avgSalary: Math.round(avgMonthly),
    estimatedAmount: severanceAmount,
  }
}

/**
 * Validate severance interim eligibility
 */
export function validateSeveranceEligibility(yearsOfService: number): { eligible: boolean; reason?: string } {
  if (yearsOfService < 1) {
    return { eligible: false, reason: '최소 1년 이상 근속해야 합니다.' }
  }
  return { eligible: true }
}
