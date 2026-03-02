// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Data Migration Utility
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'

// ─── Types ──────────────────────────────────────────────────

export interface ValidationResult {
  isValid: boolean
  totalRecords: number
  errors: Array<{ row: number; field: string; message: string }>
  warnings: Array<{ row: number; field: string; message: string }>
}

export interface FieldMapping {
  sourceField: string
  targetField: string
  transform?: 'uppercase' | 'lowercase' | 'date_iso' | 'trim' | 'number'
}

// ─── Required Fields per Scope ──────────────────────────────

const REQUIRED_FIELDS: Record<string, string[]> = {
  EMPLOYEES: ['employeeNo', 'name', 'email', 'departmentId', 'jobGradeId', 'hireDate', 'status'],
  ATTENDANCE: ['employeeNo', 'workDate', 'clockIn', 'clockOut', 'workType'],
  PAYROLL: ['employeeNo', 'yearMonth', 'baseSalary', 'grossPay', 'deductions', 'netPay'],
  LEAVE: ['employeeNo', 'leaveType', 'startDate', 'endDate', 'days'],
  PERFORMANCE: ['employeeNo', 'period', 'goalTitle', 'score'],
}

// ─── Sample Templates per Scope ─────────────────────────────

const SAMPLE_TEMPLATES: Record<string, Record<string, string>> = {
  EMPLOYEES: {
    employeeNo: 'EMP-001',
    name: '홍길동',
    email: 'gildong.hong@ctr.com',
    departmentId: 'uuid-of-department',
    jobGradeId: 'uuid-of-job-grade',
    hireDate: '2024-01-15',
    status: 'ACTIVE',
    phone: '010-1234-5678',
    position: '사원',
  },
  ATTENDANCE: {
    employeeNo: 'EMP-001',
    workDate: '2024-03-01',
    clockIn: '09:00',
    clockOut: '18:00',
    workType: 'OFFICE',
    overtimeMinutes: '0',
    note: '',
  },
  PAYROLL: {
    employeeNo: 'EMP-001',
    yearMonth: '2024-03',
    baseSalary: '3500000',
    grossPay: '4000000',
    deductions: '500000',
    netPay: '3500000',
    overtimePay: '0',
    bonusPay: '0',
  },
  LEAVE: {
    employeeNo: 'EMP-001',
    leaveType: 'ANNUAL',
    startDate: '2024-03-15',
    endDate: '2024-03-16',
    days: '2',
    reason: '개인 사유',
  },
  PERFORMANCE: {
    employeeNo: 'EMP-001',
    period: '2024-H1',
    goalTitle: '분기 매출 목표 달성',
    score: '4.5',
    weight: '30',
    comment: '목표 대비 120% 달성',
  },
}

// ─── Validate Migration Data ────────────────────────────────

export async function validateMigrationData(
  scope: string,
  data: Record<string, unknown>[],
): Promise<ValidationResult> {
  const errors: ValidationResult['errors'] = []
  const warnings: ValidationResult['warnings'] = []
  const requiredFields = REQUIRED_FIELDS[scope] ?? []

  for (let i = 0; i < data.length; i++) {
    const row = data[i]
    const rowNum = i + 1

    // Check required fields
    for (const field of requiredFields) {
      const value = row[field]
      if (value === undefined || value === null || value === '') {
        errors.push({
          row: rowNum,
          field,
          message: `필수 필드 '${field}'이(가) 비어 있습니다.`,
        })
      }
    }

    // Type-specific validations
    if (scope === 'EMPLOYEES') {
      // Email format check
      if (row.email && typeof row.email === 'string') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(row.email)) {
          errors.push({ row: rowNum, field: 'email', message: '올바르지 않은 이메일 형식입니다.' })
        }
      }
      // Date format check
      if (row.hireDate && typeof row.hireDate === 'string') {
        const dateVal = new Date(row.hireDate)
        if (isNaN(dateVal.getTime())) {
          errors.push({ row: rowNum, field: 'hireDate', message: '올바르지 않은 날짜 형식입니다. (YYYY-MM-DD)' })
        }
      }
      // Status validation
      const validStatuses = ['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'PROBATION', 'TERMINATED']
      if (row.status && typeof row.status === 'string' && !validStatuses.includes(row.status)) {
        errors.push({ row: rowNum, field: 'status', message: `유효하지 않은 상태입니다: ${row.status}` })
      }
    }

    if (scope === 'ATTENDANCE') {
      // Work date validation
      if (row.workDate && typeof row.workDate === 'string') {
        const dateVal = new Date(row.workDate)
        if (isNaN(dateVal.getTime())) {
          errors.push({ row: rowNum, field: 'workDate', message: '올바르지 않은 날짜 형식입니다. (YYYY-MM-DD)' })
        }
      }
      // Time format check
      const timeRegex = /^\d{2}:\d{2}$/
      if (row.clockIn && typeof row.clockIn === 'string' && !timeRegex.test(row.clockIn)) {
        errors.push({ row: rowNum, field: 'clockIn', message: '올바르지 않은 시간 형식입니다. (HH:MM)' })
      }
      if (row.clockOut && typeof row.clockOut === 'string' && !timeRegex.test(row.clockOut)) {
        errors.push({ row: rowNum, field: 'clockOut', message: '올바르지 않은 시간 형식입니다. (HH:MM)' })
      }
    }

    if (scope === 'PAYROLL') {
      // Numeric validations
      for (const numField of ['baseSalary', 'grossPay', 'deductions', 'netPay']) {
        if (row[numField] !== undefined && row[numField] !== null) {
          const num = Number(row[numField])
          if (isNaN(num)) {
            errors.push({ row: rowNum, field: numField, message: `'${numField}'은(는) 숫자여야 합니다.` })
          } else if (num < 0) {
            warnings.push({ row: rowNum, field: numField, message: `'${numField}'에 음수 값이 있습니다.` })
          }
        }
      }
      // yearMonth format
      if (row.yearMonth && typeof row.yearMonth === 'string') {
        const ymRegex = /^\d{4}-(0[1-9]|1[0-2])$/
        if (!ymRegex.test(row.yearMonth)) {
          errors.push({ row: rowNum, field: 'yearMonth', message: '올바르지 않은 년월 형식입니다. (YYYY-MM)' })
        }
      }
    }

    if (scope === 'LEAVE') {
      // Date validations
      for (const dateField of ['startDate', 'endDate']) {
        if (row[dateField] && typeof row[dateField] === 'string') {
          const dateVal = new Date(row[dateField] as string)
          if (isNaN(dateVal.getTime())) {
            errors.push({ row: rowNum, field: dateField, message: '올바르지 않은 날짜 형식입니다. (YYYY-MM-DD)' })
          }
        }
      }
      // Days numeric
      if (row.days !== undefined && row.days !== null) {
        const days = Number(row.days)
        if (isNaN(days) || days <= 0) {
          errors.push({ row: rowNum, field: 'days', message: '사용일수는 0보다 큰 숫자여야 합니다.' })
        }
      }
      // Date order
      if (row.startDate && row.endDate) {
        const start = new Date(row.startDate as string)
        const end = new Date(row.endDate as string)
        if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start > end) {
          errors.push({ row: rowNum, field: 'endDate', message: '종료일이 시작일보다 빠릅니다.' })
        }
      }
    }

    if (scope === 'PERFORMANCE') {
      // Score numeric
      if (row.score !== undefined && row.score !== null) {
        const score = Number(row.score)
        if (isNaN(score)) {
          errors.push({ row: rowNum, field: 'score', message: '점수는 숫자여야 합니다.' })
        } else if (score < 0 || score > 5) {
          warnings.push({ row: rowNum, field: 'score', message: '점수가 일반적인 범위(0-5)를 벗어났습니다.' })
        }
      }
    }

    // Duplicate employeeNo warning (referential integrity mock)
    if (row.employeeNo && i > 0) {
      const duplicates = data.slice(0, i).filter((r) => r.employeeNo === row.employeeNo)
      if (duplicates.length > 0 && scope !== 'ATTENDANCE' && scope !== 'PERFORMANCE') {
        warnings.push({ row: rowNum, field: 'employeeNo', message: `사번 '${row.employeeNo}'이(가) 중복되었습니다.` })
      }
    }
  }

  return {
    isValid: errors.length === 0,
    totalRecords: data.length,
    errors,
    warnings,
  }
}

// ─── Execute Migration (Mock) ───────────────────────────────

export async function executeMigration(
  jobId: string,
  scope: string,
  data: Record<string, unknown>[],
): Promise<void> {
  let successCount = 0
  let errorCount = 0

  for (let i = 0; i < data.length; i++) {
    const row = data[i]
    const recordRef = (row.employeeNo as string) ?? `row-${i + 1}`

    try {
      // Mock: simulate processing each record
      // In production, this would insert into the target tables
      // e.g., prisma.employee.create(), prisma.attendanceRecord.create(), etc.

      await prisma.migrationLog.create({
        data: {
          jobId,
          level: 'INFO',
          message: `레코드 처리 완료: ${recordRef} (${i + 1}/${data.length})`,
          recordRef,
          detail: JSON.parse(JSON.stringify(row)),
        },
      })

      successCount++
    } catch (err) {
      errorCount++

      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류'

      await prisma.migrationLog.create({
        data: {
          jobId,
          level: 'ERROR',
          message: `레코드 처리 실패: ${recordRef} - ${errorMessage}`,
          recordRef,
          detail: JSON.parse(JSON.stringify({ row: i + 1, error: errorMessage, data: row })),
        },
      })
    }

    // Update progress
    await prisma.migrationJob.update({
      where: { id: jobId },
      data: {
        processedRecords: i + 1,
        successRecords: successCount,
        errorRecords: errorCount,
      },
    })
  }

  // Final status
  const finalStatus = errorCount === 0 ? 'COMPLETED' : (successCount === 0 ? 'FAILED' : 'COMPLETED')

  await prisma.migrationJob.update({
    where: { id: jobId },
    data: {
      status: finalStatus,
      completedAt: new Date(),
    },
  })

  await prisma.migrationLog.create({
    data: {
      jobId,
      level: errorCount > 0 ? 'WARNING' : 'INFO',
      message: `마이그레이션 완료: 총 ${data.length}건 중 성공 ${successCount}건, 실패 ${errorCount}건`,
    },
  })
}

// ─── Get Required Fields ────────────────────────────────────

export function getRequiredFields(scope: string): string[] {
  if (scope === 'ALL') {
    return Object.values(REQUIRED_FIELDS).flat()
  }
  return REQUIRED_FIELDS[scope] ?? []
}

// ─── Get Sample Template ────────────────────────────────────

export function getSampleTemplate(scope: string): Record<string, string> {
  if (scope === 'ALL') {
    return Object.values(SAMPLE_TEMPLATES).reduce((acc, tpl) => ({ ...acc, ...tpl }), {})
  }
  return SAMPLE_TEMPLATES[scope] ?? {}
}
