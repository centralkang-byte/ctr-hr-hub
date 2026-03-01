// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Russian Compliance Utilities (CTR-RU)
// ═══════════════════════════════════════════════════════════

import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'

// ─── T-2 Military Registration Form ──────────────────────
// Generates data for military registration T-2 form (Форма T-2)

export async function generateT2Report(companyId: string) {
  const registrations = await prisma.militaryRegistration.findMany({
    where: { companyId },
    include: {
      employee: {
        select: {
          id: true,
          name: true,
          employeeNo: true,
          birthDate: true,
          gender: true,
          hireDate: true,
          department: { select: { name: true } },
          jobGrade: { select: { name: true } },
          jobCategory: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  return registrations.map((reg) => ({
    id: reg.id,
    employeeId: reg.employeeId,
    employeeNo: reg.employee.employeeNo,
    name: reg.employee.name,
    birthDate: reg.employee.birthDate,
    gender: reg.employee.gender,
    hireDate: reg.employee.hireDate,
    department: reg.employee.department?.name ?? null,
    jobGrade: reg.employee.jobGrade?.name ?? null,
    jobCategory: reg.employee.jobCategory?.name ?? null,
    militaryCategory: reg.category,
    rank: reg.rank,
    specialtyCode: reg.specialtyCode,
    fitnessCategory: reg.fitnessCategory,
    militaryOffice: reg.militaryOffice,
    registrationDate: reg.registrationDate,
    deregistrationDate: reg.deregistrationDate,
    notes: reg.notes,
  }))
}

// ─── P-4 Quarterly Employee/Salary Stats ─────────────────
// Generates quarterly statistics for Federal Statistical Observation Form P-4

export async function generateP4Report(companyId: string, year: number, quarter: number) {
  const quarterStart = new Date(year, (quarter - 1) * 3, 1)
  const quarterEnd = new Date(year, quarter * 3, 0, 23, 59, 59)

  const employees = await prisma.employee.findMany({
    where: {
      companyId,
      hireDate: { lte: quarterEnd },
      OR: [
        { resignDate: null },
        { resignDate: { gte: quarterStart } },
      ],
      deletedAt: null,
    },
    include: {
      department: { select: { name: true } },
      jobCategory: { select: { name: true } },
    },
  })

  const byDepartment = employees.reduce(
    (acc, emp) => {
      const dept = emp.department?.name ?? '미분류'
      if (!acc[dept]) {
        acc[dept] = { department: dept, headcount: 0, employeeIds: [] }
      }
      acc[dept].headcount++
      acc[dept].employeeIds.push(emp.id)
      return acc
    },
    {} as Record<string, { department: string; headcount: number; employeeIds: string[] }>,
  )

  return {
    companyId,
    year,
    quarter,
    periodStart: quarterStart.toISOString(),
    periodEnd: quarterEnd.toISOString(),
    totalHeadcount: employees.length,
    reportDate: new Date().toISOString(),
    departments: Object.values(byDepartment).map(({ employeeIds: _ids, ...rest }) => rest),
  }
}

// ─── 57-T Annual Salary Survey ────────────────────────────
// Generates annual salary survey by job category for Rosstat Form 57-T

export async function generate57TReport(companyId: string, year: number) {
  const yearStart = new Date(year, 0, 1)
  const yearEnd = new Date(year, 11, 31, 23, 59, 59)

  const employees = await prisma.employee.findMany({
    where: {
      companyId,
      hireDate: { lte: yearEnd },
      OR: [
        { resignDate: null },
        { resignDate: { gte: yearStart } },
      ],
      deletedAt: null,
    },
    include: {
      jobCategory: { select: { id: true, name: true, code: true } },
      jobGrade: { select: { id: true, name: true, code: true } },
    },
  })

  const byJobCategory = employees.reduce(
    (acc, emp) => {
      const catKey = emp.jobCategory?.code ?? 'UNKNOWN'
      const catName = emp.jobCategory?.name ?? '미분류'
      if (!acc[catKey]) {
        acc[catKey] = {
          categoryCode: catKey,
          categoryName: catName,
          headcount: 0,
        }
      }
      acc[catKey].headcount++
      return acc
    },
    {} as Record<string, { categoryCode: string; categoryName: string; headcount: number }>,
  )

  return {
    companyId,
    year,
    reportDate: new Date().toISOString(),
    totalHeadcount: employees.length,
    jobCategories: Object.values(byJobCategory),
  }
}

// ─── KEDO Signature Hash ─────────────────────────────────
// Generates SHA-256 hash for KEDO (КЭДО) electronic document signing

export function generateKedoSignatureHash(
  docId: string,
  signerId: string,
  timestamp: string,
): string {
  const payload = `${docId}:${signerId}:${timestamp}`
  return createHash('sha256').update(payload, 'utf8').digest('hex')
}

// ─── KEDO Signature Validation ───────────────────────────
// Validates that the signature level meets requirements for the document type

const SIGNATURE_REQUIREMENTS: Record<string, string[]> = {
  // Documents requiring enhanced qualified signature (УКЭП)
  EMPLOYMENT_CONTRACT: ['UKEP'],
  SUPPLEMENTARY_AGREEMENT: ['UKEP'],
  DISMISSAL_ORDER: ['UKEP'],
  // Documents accepting enhanced unqualified (УНЭП) or qualified
  TRANSFER_ORDER: ['UNEP', 'UKEP'],
  SALARY_CHANGE: ['UNEP', 'UKEP'],
  DISCIPLINARY_ORDER: ['UNEP', 'UKEP'],
  // Documents accepting simple electronic signature (ПЭП)
  VACATION_ORDER: ['PEP', 'UNEP', 'UKEP'],
}

export function validateKedoSignature(
  signatureLevel: string,
  documentType: string,
): { valid: boolean; required: string[]; message?: string } {
  const required = SIGNATURE_REQUIREMENTS[documentType]

  if (!required) {
    return {
      valid: false,
      required: [],
      message: `Unknown document type: ${documentType}`,
    }
  }

  const valid = required.includes(signatureLevel)

  return {
    valid,
    required,
    message: valid
      ? undefined
      : `Document type ${documentType} requires one of [${required.join(', ')}] but received ${signatureLevel}`,
  }
}
