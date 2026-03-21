import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'
import { parseDateOnly } from '@/lib/timezone'
import type {
  MovementTemplate,
  ParsedRow,
  ValidationError,
  ValidationRow,
  ValidateResponse,
} from './types'

// Prisma include 결과 타입 (findFirst + include)
const assignmentInclude = {
  company: { select: { id: true, code: true, name: true } },
  department: { select: { id: true, name: true, code: true } },
  jobGrade: { select: { id: true, name: true, code: true } },
  position: { select: { id: true } },
  workLocation: { select: { id: true } },
} as const

type CurrentAssignment = NonNullable<
  Awaited<ReturnType<typeof prisma.employeeAssignment.findFirst<{
    include: typeof assignmentInclude
  }>>>
>

/**
 * CSV 행들을 검증하고 프리뷰를 생성.
 *
 * 검증 순서:
 * 1. 파일 내 중복 사번 검출
 * 2. Zod schema 검증 (필수 필드, 형식)
 * 3. 참조 데이터 DB 조회 (사번→Employee, 부서코드→Department 등)
 * 4. 비즈니스 룰 검증 (발효일 역전 차단, 상태 전이 등)
 */
export async function validateRows(
  rows: ParsedRow[],
  template: MovementTemplate,
  userCompanyId: string,
  fileBuffer: ArrayBuffer,
): Promise<ValidateResponse> {
  const errors: ValidationError[] = []
  const preview: ValidationRow[] = []

  // ── 파일 내 중복 사번 검출 ──
  const empNoCounts = new Map<string, number[]>()
  for (const row of rows) {
    const empNo = (row.raw['사번'] ?? '').trim()
    if (empNo) {
      const existing = empNoCounts.get(empNo) ?? []
      existing.push(row.rowNum)
      empNoCounts.set(empNo, existing)
    }
  }
  for (const [empNo, rowNums] of empNoCounts) {
    if (rowNums.length > 1) {
      for (const rowNum of rowNums) {
        errors.push({
          row: rowNum,
          column: '사번',
          message: `사번 '${empNo}'이 파일 내에서 ${rowNums.length}번 중복됩니다`,
          severity: 'error',
        })
      }
    }
  }

  // ── 행별 검증 ──
  for (const row of rows) {
    // 1. Zod schema 검증
    const parseResult = template.rowSchema.safeParse(row.raw)
    if (!parseResult.success) {
      for (const issue of parseResult.error.issues) {
        errors.push({
          row: row.rowNum,
          column: issue.path[0]?.toString() ?? '',
          message: issue.message,
          severity: 'error',
        })
      }
      preview.push({
        rowNum: row.rowNum,
        employeeNo: (row.raw['사번'] ?? '').trim(),
        employeeName: '',
        currentValue: '',
        newValue: '',
        status: 'error',
      })
      continue
    }

    const empNo = (row.raw['사번'] ?? '').trim()

    // 2. 직원 조회
    const employee = await prisma.employee.findFirst({
      where: { employeeNo: empNo, deletedAt: null },
      select: { id: true, name: true },
    })
    if (!employee) {
      errors.push({
        row: row.rowNum,
        column: '사번',
        message: `사번 '${empNo}'을 찾을 수 없습니다`,
        severity: 'error',
      })
      preview.push({
        rowNum: row.rowNum,
        employeeNo: empNo,
        employeeName: '',
        currentValue: '',
        newValue: '',
        status: 'error',
      })
      continue
    }

    // 3. 현재 활성 assignment 조회
    const currentAssignment = await prisma.employeeAssignment.findFirst({
      where: { employeeId: employee.id, isPrimary: true, endDate: null },
      include: assignmentInclude,
    })
    if (!currentAssignment) {
      errors.push({
        row: row.rowNum,
        column: '사번',
        message: `사번 '${empNo}'의 활성 발령이 없습니다`,
        severity: 'error',
      })
      preview.push({
        rowNum: row.rowNum,
        employeeNo: empNo,
        employeeName: employee.name,
        currentValue: '',
        newValue: '',
        status: 'error',
      })
      continue
    }

    // 4. 회사 범위 검증 (HR_ADMIN은 자기 법인만)
    // SUPER_ADMIN은 userCompanyId가 빈 문자열일 수 있으므로 skip
    if (userCompanyId && currentAssignment.companyId !== userCompanyId) {
      errors.push({
        row: row.rowNum,
        column: '사번',
        message: `사번 '${empNo}'은 다른 법인 소속입니다. 처리 권한이 없습니다`,
        severity: 'error',
      })
      preview.push({
        rowNum: row.rowNum,
        employeeNo: empNo,
        employeeName: employee.name,
        currentValue: '',
        newValue: '',
        status: 'error',
      })
      continue
    }

    // 5. 발효일 역전 검증 (Gemini Patch 2)
    const effectiveDateStr = row.raw['발효일'] ?? row.raw['마지막근무일'] ?? ''
    if (effectiveDateStr) {
      const inputDate = parseDateOnly(effectiveDateStr)
      const currentEffective = currentAssignment.effectiveDate
      if (inputDate < currentEffective) {
        errors.push({
          row: row.rowNum,
          column: '발효일',
          message: `발효일(${effectiveDateStr})이 현재 발령 시작일(${currentEffective.toISOString().slice(0, 10)})보다 과거입니다`,
          severity: 'error',
        })
        preview.push({
          rowNum: row.rowNum,
          employeeNo: empNo,
          employeeName: employee.name,
          currentValue: '',
          newValue: '',
          status: 'error',
        })
        continue
      }
    }

    // 6. 타입별 참조 데이터 검증 + 프리뷰 생성
    const typeResult = await validateByType(
      template.type,
      row,
      employee,
      currentAssignment,
      errors,
    )

    preview.push({
      rowNum: row.rowNum,
      employeeNo: empNo,
      employeeName: employee.name,
      currentValue: typeResult.currentValue,
      newValue: typeResult.newValue,
      status: typeResult.hasError ? 'error' : typeResult.hasWarning ? 'warning' : 'valid',
    })
  }

  const hasErrors = errors.some((e) => e.severity === 'error')

  // validationToken: SHA256(파일 내용 + 타임스탬프)
  const tokenInput = Buffer.from(fileBuffer)
  const timestamp = Date.now().toString()
  const hash = createHash('sha256')
    .update(tokenInput)
    .update(timestamp)
    .digest('hex')
  const validationToken = hasErrors ? null : `${hash}:${timestamp}`

  return {
    valid: !hasErrors,
    totalRows: rows.length,
    validRows: rows.length - errors.filter((e) => e.severity === 'error').length,
    errors,
    preview,
    validationToken,
  }
}

// ── 타입별 참조 데이터 검증 ──

interface TypeValidationResult {
  currentValue: string
  newValue: string
  hasError: boolean
  hasWarning: boolean
}

async function validateByType(
  type: string,
  row: ParsedRow,
  employee: { id: string; name: string },
  currentAssignment: CurrentAssignment,
  errors: ValidationError[],
): Promise<TypeValidationResult> {
  let currentValue = ''
  let newValue = ''
  let hasError = false
  let hasWarning = false

  switch (type) {
    case 'transfer': {
      const deptCode = (row.raw['부서코드'] ?? '').trim()
      const dept = await prisma.department.findFirst({
        where: { code: deptCode, isActive: true },
        select: { id: true, name: true, companyId: true },
      })
      if (!dept) {
        errors.push({
          row: row.rowNum,
          column: '부서코드',
          message: `부서코드 '${deptCode}'를 찾을 수 없습니다`,
          severity: 'error',
        })
        hasError = true
      }
      // 직급코드 검증 (선택)
      const gradeCode = (row.raw['직급코드'] ?? '').trim()
      if (gradeCode) {
        const grade = await prisma.jobGrade.findFirst({
          where: { code: gradeCode, deletedAt: null },
          select: { id: true },
        })
        if (!grade) {
          errors.push({
            row: row.rowNum,
            column: '직급코드',
            message: `직급코드 '${gradeCode}'를 찾을 수 없습니다`,
            severity: 'error',
          })
          hasError = true
        }
      }
      currentValue = currentAssignment.department?.name ?? '(미지정)'
      newValue = dept?.name ?? deptCode
      break
    }

    case 'promotion': {
      const gradeCode = (row.raw['새직급코드'] ?? '').trim()
      const grade = await prisma.jobGrade.findFirst({
        where: { code: gradeCode, deletedAt: null },
        select: { id: true, name: true, rankOrder: true },
      })
      if (!grade) {
        errors.push({
          row: row.rowNum,
          column: '새직급코드',
          message: `직급코드 '${gradeCode}'를 찾을 수 없습니다`,
          severity: 'error',
        })
        hasError = true
      } else if (currentAssignment.jobGrade) {
        // rankOrder 비교 (낮을수록 높은 직급)
        const currentGrade = await prisma.jobGrade.findUnique({
          where: { id: currentAssignment.jobGrade.id },
          select: { rankOrder: true },
        })
        if (currentGrade && grade.rankOrder >= currentGrade.rankOrder) {
          errors.push({
            row: row.rowNum,
            column: '새직급코드',
            message: '새 직급이 현재 직급보다 높지 않습니다',
            severity: 'warning',
          })
          hasWarning = true
        }
      }
      currentValue = currentAssignment.jobGrade?.name ?? '(미지정)'
      newValue = grade?.name ?? gradeCode
      break
    }

    case 'entity-transfer': {
      const companyCode = (row.raw['전환법인코드'] ?? '').trim()
      const company = await prisma.company.findFirst({
        where: { code: companyCode, deletedAt: null },
        select: { id: true, name: true },
      })
      if (!company) {
        errors.push({
          row: row.rowNum,
          column: '전환법인코드',
          message: `법인코드 '${companyCode}'를 찾을 수 없습니다`,
          severity: 'error',
        })
        hasError = true
      }
      const deptCode = (row.raw['부서코드'] ?? '').trim()
      const dept = await prisma.department.findFirst({
        where: { code: deptCode, isActive: true },
        select: { id: true, name: true, companyId: true },
      })
      if (!dept) {
        errors.push({
          row: row.rowNum,
          column: '부서코드',
          message: `부서코드 '${deptCode}'를 찾을 수 없습니다`,
          severity: 'error',
        })
        hasError = true
      } else if (company && dept.companyId !== company.id) {
        errors.push({
          row: row.rowNum,
          column: '부서코드',
          message: `부서 '${deptCode}'가 법인 '${companyCode}'에 속하지 않습니다`,
          severity: 'error',
        })
        hasError = true
      }
      // 겸직 경고
      const secondaryCount = await prisma.employeeAssignment.count({
        where: { employeeId: employee.id, isPrimary: false, endDate: null },
      })
      if (secondaryCount > 0) {
        errors.push({
          row: row.rowNum,
          column: '사번',
          message: `겸직 ${secondaryCount}건이 존재합니다. 법인전환 시 겸직 처리를 확인하세요`,
          severity: 'warning',
        })
        hasWarning = true
      }
      currentValue = currentAssignment.company.name
      newValue = company?.name ?? companyCode
      break
    }

    case 'termination': {
      const resignType = (row.raw['퇴직구분'] ?? '').trim()
      // 이미 퇴직 상태인지 확인
      if (['RESIGNED', 'TERMINATED'].includes(currentAssignment.status)) {
        errors.push({
          row: row.rowNum,
          column: '사번',
          message: '이미 퇴직 처리된 직원입니다',
          severity: 'error',
        })
        hasError = true
      }
      currentValue = currentAssignment.status
      newValue = ['VOLUNTARY', 'RETIREMENT'].includes(resignType)
        ? 'RESIGNED'
        : 'TERMINATED'
      break
    }

    case 'compensation': {
      const newSalary = Number(row.raw['새기본급'] ?? '0')
      // SalaryBand 검증 (경고만)
      if (currentAssignment.jobGrade) {
        const band = await prisma.salaryBand.findFirst({
          where: {
            companyId: currentAssignment.companyId,
            jobGradeId: currentAssignment.jobGrade.id,
            deletedAt: null,
            effectiveFrom: { lte: new Date() },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
          },
          select: { minSalary: true, maxSalary: true },
        })
        if (band) {
          const min = Number(band.minSalary)
          const max = Number(band.maxSalary)
          if (newSalary < min || newSalary > max) {
            errors.push({
              row: row.rowNum,
              column: '새기본급',
              message: `급여 ${newSalary.toLocaleString()}이 Salary Band 범위(${min.toLocaleString()}~${max.toLocaleString()})를 벗어납니다`,
              severity: 'warning',
            })
            hasWarning = true
          }
        }
      }
      currentValue = '(현재 급여)'
      newValue = `${newSalary.toLocaleString()}`
      break
    }
  }

  return { currentValue, newValue, hasError, hasWarning }
}

/**
 * validationToken 검증.
 * 토큰 형식: `{sha256hash}:{timestamp}`
 * 파일 해시가 일치하는지 + 토큰 발급 후 30분 이내인지 확인.
 */
export function verifyValidationToken(
  token: string,
  fileBuffer: ArrayBuffer,
): { valid: boolean; reason?: string } {
  const parts = token.split(':')
  if (parts.length !== 2) {
    return { valid: false, reason: '토큰 형식이 올바르지 않습니다' }
  }

  const [originalHash, timestampStr] = parts
  const timestamp = parseInt(timestampStr, 10)
  if (isNaN(timestamp)) {
    return { valid: false, reason: '토큰 타임스탬프가 올바르지 않습니다' }
  }

  // 30분 만료
  const elapsed = Date.now() - timestamp
  if (elapsed > 30 * 60 * 1000) {
    return {
      valid: false,
      reason: '검증 토큰이 만료되었습니다 (30분). 다시 검증해 주세요',
    }
  }

  // 파일 해시 검증
  const currentHash = createHash('sha256')
    .update(Buffer.from(fileBuffer))
    .update(timestampStr)
    .digest('hex')

  if (currentHash !== originalHash) {
    return {
      valid: false,
      reason: '파일이 검증 시점과 다릅니다. 다시 업로드해 주세요',
    }
  }

  return { valid: true }
}
