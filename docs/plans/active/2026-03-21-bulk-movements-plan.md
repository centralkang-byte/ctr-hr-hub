# B-5a: Bulk HR Movements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** CSV 기반 대량 인사이동 — 유형별 분리 템플릿, 3단계 위자드 UI, All-or-Nothing 실행

**Architecture:** 5개 movement type별 template config(컬럼 정의 + Zod schema + 실행 함수)를 레지스트리 패턴으로 관리. API 3개(templates/validate/execute)가 공통 parser/validator/executor를 호출. UI는 3-step wizard (TypeSelector → FileUpload+Preview → ExecutionConfirm).

**Tech Stack:** Next.js 15 API Routes, Zod 4, Prisma 7, csv-parse (신규), shadcn/ui, React Hook Form

**Design Doc:** `docs/plans/active/2026-03-21-bulk-movements-design.md`

---

## Task 1: 공통 타입 및 템플릿 레지스트리 (src/lib/bulk-movement/)

**Files:**
- Create: `src/lib/bulk-movement/types.ts`
- Create: `src/lib/bulk-movement/templates/index.ts`
- Create: `src/lib/bulk-movement/templates/transfer.ts`
- Create: `src/lib/bulk-movement/templates/promotion.ts`
- Create: `src/lib/bulk-movement/templates/entity-transfer.ts`
- Create: `src/lib/bulk-movement/templates/termination.ts`
- Create: `src/lib/bulk-movement/templates/compensation.ts`

**Step 1: npm install csv-parse**

```bash
npm install csv-parse
```

**Step 2: 공통 타입 정의 — `types.ts`**

```typescript
// src/lib/bulk-movement/types.ts
import type { z } from 'zod'

export const MOVEMENT_TYPES = [
  'transfer',
  'promotion',
  'entity-transfer',
  'termination',
  'compensation',
] as const

export type MovementType = (typeof MOVEMENT_TYPES)[number]

export function isValidMovementType(value: string): value is MovementType {
  return MOVEMENT_TYPES.includes(value as MovementType)
}

// 템플릿 컬럼 정의
export interface TemplateColumn {
  key: string        // CSV 헤더명 (한국어)
  field: string      // 내부 필드명 (영어)
  required: boolean
  description: string
  example: string
}

// 검증 결과 행
export interface ValidationRow {
  rowNum: number
  employeeNo: string
  employeeName: string
  currentValue: string
  newValue: string
  status: 'valid' | 'error' | 'warning'
}

// 검증 에러
export interface ValidationError {
  row: number
  column: string
  message: string
  severity: 'error' | 'warning'
}

// validate API 응답
export interface ValidateResponse {
  valid: boolean
  totalRows: number
  validRows: number
  errors: ValidationError[]
  preview: ValidationRow[]
  validationToken: string | null
}

// execute API 응답
export interface ExecuteResponse {
  success: boolean
  applied: number
  executionId: string
}

// 파싱된 CSV 행 (제네릭)
export interface ParsedRow {
  rowNum: number
  raw: Record<string, string>
}

// 검증된 행 (실행 가능)
export interface ValidatedRow {
  rowNum: number
  employeeId: string
  employeeNo: string
  employeeName: string
  // 타입별 추가 데이터는 Record로 보관
  data: Record<string, unknown>
}

// 템플릿 인터페이스 — 각 movement type이 구현
export interface MovementTemplate {
  type: MovementType
  label: string               // 한국어 표시명
  description: string         // 설명
  superAdminOnly: boolean     // ENTITY_TRANSFER만 true
  columns: TemplateColumn[]
  // Zod schema (행 단위)
  rowSchema: z.ZodType<Record<string, unknown>>
  // CSV 예시 행
  exampleRow: Record<string, string>
}
```

**Step 3: TRANSFER 템플릿 — `templates/transfer.ts`**

```typescript
// src/lib/bulk-movement/templates/transfer.ts
import { z } from 'zod'
import type { MovementTemplate, TemplateColumn } from '../types'

const columns: TemplateColumn[] = [
  { key: '사번', field: 'employeeNo', required: true, description: '직원 사번', example: 'EMP001' },
  { key: '부서코드', field: 'departmentCode', required: true, description: '이동할 부서 코드', example: 'DEV-01' },
  { key: '직급코드', field: 'jobGradeCode', required: false, description: '변경할 직급 코드', example: 'G3' },
  { key: '직위코드', field: 'positionCode', required: false, description: '변경할 직위 코드', example: 'POS-DEV-LEAD' },
  { key: '근무지코드', field: 'workLocationCode', required: false, description: '변경할 근무지 코드', example: 'HQ-SEOUL' },
  { key: '발효일', field: 'effectiveDate', required: true, description: 'YYYY-MM-DD', example: '2026-04-01' },
  { key: '사유', field: 'reason', required: false, description: '변경 사유', example: '조직개편' },
]

const rowSchema = z.object({
  사번: z.string().min(1, '사번이 필요합니다'),
  부서코드: z.string().min(1, '부서코드가 필요합니다'),
  직급코드: z.string().optional().default(''),
  직위코드: z.string().optional().default(''),
  근무지코드: z.string().optional().default(''),
  발효일: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '발효일은 YYYY-MM-DD 형식이어야 합니다'),
  사유: z.string().optional().default(''),
})

export const transferTemplate: MovementTemplate = {
  type: 'transfer',
  label: '부서이동',
  description: '부서/직급/직위/근무지 변경',
  superAdminOnly: false,
  columns,
  rowSchema,
  exampleRow: Object.fromEntries(columns.map(c => [c.key, c.example])),
}
```

**Step 4: PROMOTION 템플릿 — `templates/promotion.ts`**

```typescript
// src/lib/bulk-movement/templates/promotion.ts
import { z } from 'zod'
import type { MovementTemplate, TemplateColumn } from '../types'

const columns: TemplateColumn[] = [
  { key: '사번', field: 'employeeNo', required: true, description: '직원 사번', example: 'EMP001' },
  { key: '새직급코드', field: 'newJobGradeCode', required: true, description: '승진 후 직급 코드', example: 'G4' },
  { key: '직위코드', field: 'positionCode', required: false, description: '변경할 직위 코드', example: 'POS-MGR-01' },
  { key: '발효일', field: 'effectiveDate', required: true, description: 'YYYY-MM-DD', example: '2026-04-01' },
  { key: '사유', field: 'reason', required: false, description: '승진 사유', example: '2026년 정기승진' },
]

const rowSchema = z.object({
  사번: z.string().min(1, '사번이 필요합니다'),
  새직급코드: z.string().min(1, '새직급코드가 필요합니다'),
  직위코드: z.string().optional().default(''),
  발효일: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '발효일은 YYYY-MM-DD 형식이어야 합니다'),
  사유: z.string().optional().default(''),
})

export const promotionTemplate: MovementTemplate = {
  type: 'promotion',
  label: '승진',
  description: '직급 상향 발령',
  superAdminOnly: false,
  columns,
  rowSchema,
  exampleRow: Object.fromEntries(columns.map(c => [c.key, c.example])),
}
```

**Step 5: ENTITY_TRANSFER 템플릿 — `templates/entity-transfer.ts`**

```typescript
// src/lib/bulk-movement/templates/entity-transfer.ts
import { z } from 'zod'
import type { MovementTemplate, TemplateColumn } from '../types'

const columns: TemplateColumn[] = [
  { key: '사번', field: 'employeeNo', required: true, description: '직원 사번', example: 'EMP001' },
  { key: '전환법인코드', field: 'targetCompanyCode', required: true, description: '전환할 법인 코드', example: 'CTR-CN' },
  { key: '부서코드', field: 'departmentCode', required: true, description: '새 법인의 부서 코드', example: 'CN-DEV-01' },
  { key: '직급코드', field: 'jobGradeCode', required: false, description: '새 법인의 직급 코드', example: 'G3' },
  { key: '직위코드', field: 'positionCode', required: false, description: '새 법인의 직위 코드', example: 'POS-CN-DEV' },
  { key: '고용형태', field: 'employmentType', required: false, description: 'FULL_TIME/CONTRACT/DISPATCH/INTERN', example: 'FULL_TIME' },
  { key: '발효일', field: 'effectiveDate', required: true, description: 'YYYY-MM-DD', example: '2026-04-01' },
  { key: '사유', field: 'reason', required: false, description: '전환 사유', example: '중국법인 파견' },
]

const rowSchema = z.object({
  사번: z.string().min(1, '사번이 필요합니다'),
  전환법인코드: z.string().min(1, '전환법인코드가 필요합니다'),
  부서코드: z.string().min(1, '부서코드가 필요합니다'),
  직급코드: z.string().optional().default(''),
  직위코드: z.string().optional().default(''),
  고용형태: z.string().optional().default(''),
  발효일: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '발효일은 YYYY-MM-DD 형식이어야 합니다'),
  사유: z.string().optional().default(''),
})

export const entityTransferTemplate: MovementTemplate = {
  type: 'entity-transfer',
  label: '법인전환',
  description: '타법인 전환 (SUPER_ADMIN 전용)',
  superAdminOnly: true,
  columns,
  rowSchema,
  exampleRow: Object.fromEntries(columns.map(c => [c.key, c.example])),
}
```

**Step 6: TERMINATION 템플릿 — `templates/termination.ts`**

```typescript
// src/lib/bulk-movement/templates/termination.ts
import { z } from 'zod'
import type { MovementTemplate, TemplateColumn } from '../types'

const columns: TemplateColumn[] = [
  { key: '사번', field: 'employeeNo', required: true, description: '직원 사번', example: 'EMP001' },
  { key: '퇴직구분', field: 'resignType', required: true, description: 'VOLUNTARY/INVOLUNTARY/RETIREMENT/CONTRACT_END', example: 'VOLUNTARY' },
  { key: '마지막근무일', field: 'lastWorkingDate', required: true, description: 'YYYY-MM-DD', example: '2026-03-31' },
  { key: '퇴직사유코드', field: 'resignReasonCode', required: false, description: '퇴직 사유 코드', example: 'PERSONAL' },
  { key: '퇴직사유상세', field: 'resignReasonDetail', required: false, description: '상세 사유', example: '개인 사유' },
]

const RESIGN_TYPES = ['VOLUNTARY', 'INVOLUNTARY', 'RETIREMENT', 'CONTRACT_END'] as const

const rowSchema = z.object({
  사번: z.string().min(1, '사번이 필요합니다'),
  퇴직구분: z.enum(RESIGN_TYPES, { errorMap: () => ({ message: '퇴직구분은 VOLUNTARY/INVOLUNTARY/RETIREMENT/CONTRACT_END 중 하나여야 합니다' }) }),
  마지막근무일: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '마지막근무일은 YYYY-MM-DD 형식이어야 합니다'),
  퇴직사유코드: z.string().optional().default(''),
  퇴직사유상세: z.string().optional().default(''),
})

export const terminationTemplate: MovementTemplate = {
  type: 'termination',
  label: '퇴직',
  description: '퇴직/퇴사 처리',
  superAdminOnly: false,
  columns,
  rowSchema,
  exampleRow: Object.fromEntries(columns.map(c => [c.key, c.example])),
}
```

**Step 7: COMPENSATION 템플릿 — `templates/compensation.ts`**

```typescript
// src/lib/bulk-movement/templates/compensation.ts
import { z } from 'zod'
import type { MovementTemplate, TemplateColumn } from '../types'

const columns: TemplateColumn[] = [
  { key: '사번', field: 'employeeNo', required: true, description: '직원 사번', example: 'EMP001' },
  { key: '새기본급', field: 'newBaseSalary', required: true, description: '변경 후 기본급 (숫자)', example: '5000000' },
  { key: '변경유형', field: 'changeType', required: true, description: 'ANNUAL_INCREASE/PROMOTION/MARKET_ADJUSTMENT/OTHER', example: 'ANNUAL_INCREASE' },
  { key: '통화', field: 'currency', required: false, description: '통화 코드 (미입력 시 법인 기본)', example: 'KRW' },
  { key: '발효일', field: 'effectiveDate', required: true, description: 'YYYY-MM-DD', example: '2026-04-01' },
  { key: '사유', field: 'reason', required: false, description: '변경 사유', example: '2026년 연봉조정' },
]

const COMP_CHANGE_TYPES = ['ANNUAL_INCREASE', 'PROMOTION', 'MARKET_ADJUSTMENT', 'DEMOTION_COMP', 'TRANSFER_COMP', 'OTHER'] as const

const rowSchema = z.object({
  사번: z.string().min(1, '사번이 필요합니다'),
  새기본급: z.string().min(1, '새기본급이 필요합니다').refine(
    (v) => !isNaN(Number(v)) && Number(v) > 0,
    '새기본급은 0보다 큰 숫자여야 합니다',
  ),
  변경유형: z.enum(COMP_CHANGE_TYPES, { errorMap: () => ({ message: '변경유형이 올바르지 않습니다' }) }),
  통화: z.string().optional().default(''),
  발효일: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '발효일은 YYYY-MM-DD 형식이어야 합니다'),
  사유: z.string().optional().default(''),
})

export const compensationTemplate: MovementTemplate = {
  type: 'compensation',
  label: '급여변경',
  description: '기본급 변경',
  superAdminOnly: false,
  columns,
  rowSchema,
  exampleRow: Object.fromEntries(columns.map(c => [c.key, c.example])),
}
```

**Step 8: 템플릿 레지스트리 — `templates/index.ts`**

```typescript
// src/lib/bulk-movement/templates/index.ts
import type { MovementTemplate, MovementType } from '../types'
import { transferTemplate } from './transfer'
import { promotionTemplate } from './promotion'
import { entityTransferTemplate } from './entity-transfer'
import { terminationTemplate } from './termination'
import { compensationTemplate } from './compensation'

const templateRegistry = new Map<MovementType, MovementTemplate>([
  ['transfer', transferTemplate],
  ['promotion', promotionTemplate],
  ['entity-transfer', entityTransferTemplate],
  ['termination', terminationTemplate],
  ['compensation', compensationTemplate],
])

export function getTemplate(type: MovementType): MovementTemplate {
  const template = templateRegistry.get(type)
  if (!template) throw new Error(`알 수 없는 이동 유형: ${type}`)
  return template
}

export function getAllTemplates(): MovementTemplate[] {
  return Array.from(templateRegistry.values())
}
```

**Step 9: TypeScript 검증**

```bash
npx tsc --noEmit
```
Expected: 0 errors

**Step 10: Commit**

```bash
git add src/lib/bulk-movement/ package.json package-lock.json
git commit -m "feat(bulk-movement): add types, 5 movement templates, and registry"
```

---

## Task 2: CSV 파서 + 공통 검증기 (parser.ts + validator.ts)

**Files:**
- Create: `src/lib/bulk-movement/parser.ts`
- Create: `src/lib/bulk-movement/validator.ts`

**Step 1: CSV 파서 — `parser.ts`**

```typescript
// src/lib/bulk-movement/parser.ts
import { parse } from 'csv-parse/sync'
import type { ParsedRow } from './types'

// UTF-8 BOM 제거
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text
}

/**
 * CSV 파일을 파싱하여 행 배열로 반환.
 * - UTF-8 BOM 자동 제거
 * - 빈 행 필터링
 * - 최대 500행 제한
 */
export function parseCSV(buffer: ArrayBuffer): ParsedRow[] {
  const decoder = new TextDecoder('utf-8')
  const text = stripBom(decoder.decode(buffer))

  const records: Record<string, string>[] = parse(text, {
    columns: true,          // 첫 행을 헤더로 사용
    skip_empty_lines: true,
    trim: true,
    relaxColumnCount: true, // 컬럼 수 불일치 허용 (에러 대신 빈값)
  })

  return records.map((raw, index) => ({
    rowNum: index + 1,  // 1-based (헤더 제외)
    raw,
  }))
}

/**
 * CSV 헤더 검증: 템플릿에 정의된 필수 컬럼이 모두 존재하는지 확인.
 * 반환: 누락된 필수 컬럼 목록 (빈 배열이면 OK)
 */
export function validateHeaders(
  parsedHeaders: string[],
  templateHeaders: { key: string; required: boolean }[],
): string[] {
  const missing: string[] = []
  for (const col of templateHeaders) {
    if (col.required && !parsedHeaders.includes(col.key)) {
      missing.push(col.key)
    }
  }
  return missing
}
```

**Step 2: 공통 검증기 — `validator.ts`**

이 파일이 핵심. DB 조회, 비즈니스 룰 검증, 프리뷰 생성을 담당.

```typescript
// src/lib/bulk-movement/validator.ts
import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'
import { parseDateOnly } from '@/lib/timezone'
import type { MovementTemplate, ParsedRow, ValidationError, ValidationRow, ValidateResponse } from './types'

/**
 * CSV 행들을 검증하고 프리뷰를 생성.
 *
 * 검증 순서:
 * 1. Zod schema 검증 (필수 필드, 형식)
 * 2. 참조 데이터 DB 조회 (사번→Employee, 부서코드→Department 등)
 * 3. 비즈니스 룰 검증 (발효일 역전 차단, 상태 전이 등)
 * 4. 파일 내 중복 사번 검증
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
      errors.push({ row: row.rowNum, column: '사번', message: `사번 '${empNo}'을 찾을 수 없습니다`, severity: 'error' })
      preview.push({ rowNum: row.rowNum, employeeNo: empNo, employeeName: '', currentValue: '', newValue: '', status: 'error' })
      continue
    }

    // 3. 현재 활성 assignment 조회
    const currentAssignment = await prisma.employeeAssignment.findFirst({
      where: { employeeId: employee.id, isPrimary: true, endDate: null },
      include: { company: true, department: true, jobGrade: true, position: true, workLocation: true },
    })
    if (!currentAssignment) {
      errors.push({ row: row.rowNum, column: '사번', message: `사번 '${empNo}'의 활성 발령이 없습니다`, severity: 'error' })
      preview.push({ rowNum: row.rowNum, employeeNo: empNo, employeeName: employee.name, currentValue: '', newValue: '', status: 'error' })
      continue
    }

    // 4. 회사 범위 검증 (HR_ADMIN은 자기 법인만)
    // SUPER_ADMIN은 userCompanyId가 null일 수 있으므로 skip
    if (userCompanyId && currentAssignment.companyId !== userCompanyId) {
      errors.push({ row: row.rowNum, column: '사번', message: `사번 '${empNo}'은 다른 법인 소속입니다. 처리 권한이 없습니다`, severity: 'error' })
      preview.push({ rowNum: row.rowNum, employeeNo: empNo, employeeName: employee.name, currentValue: '', newValue: '', status: 'error' })
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
        preview.push({ rowNum: row.rowNum, employeeNo: empNo, employeeName: employee.name, currentValue: '', newValue: '', status: 'error' })
        continue
      }
    }

    // 6. 타입별 참조 데이터 검증 + 프리뷰 생성
    const typeResult = await validateByType(template.type, row, employee, currentAssignment, errors)

    preview.push({
      rowNum: row.rowNum,
      employeeNo: empNo,
      employeeName: employee.name,
      currentValue: typeResult.currentValue,
      newValue: typeResult.newValue,
      status: typeResult.hasError ? 'error' : typeResult.hasWarning ? 'warning' : 'valid',
    })
  }

  const hasErrors = errors.some(e => e.severity === 'error')

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
    validRows: rows.length - errors.filter(e => e.severity === 'error').length,
    errors,
    preview,
    validationToken,
  }
}

// ── 타입별 참조 데이터 검증 ──
// currentAssignment 타입은 Prisma include 결과
type CurrentAssignment = NonNullable<Awaited<ReturnType<typeof prisma.employeeAssignment.findFirst>>>
  & {
    company: { id: string; code: string; name: string }
    department: { id: string; name: string; code: string } | null
    jobGrade: { id: string; name: string; code: string } | null
    position: { id: string } | null
    workLocation: { id: string } | null
  }

async function validateByType(
  type: string,
  row: ParsedRow,
  employee: { id: string; name: string },
  currentAssignment: CurrentAssignment,
  errors: ValidationError[],
): Promise<{ currentValue: string; newValue: string; hasError: boolean; hasWarning: boolean }> {
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
        errors.push({ row: row.rowNum, column: '부서코드', message: `부서코드 '${deptCode}'를 찾을 수 없습니다`, severity: 'error' })
        hasError = true
      }
      // 직급코드 검증 (선택)
      const gradeCode = (row.raw['직급코드'] ?? '').trim()
      if (gradeCode) {
        const grade = await prisma.jobGrade.findFirst({ where: { code: gradeCode, deletedAt: null }, select: { id: true } })
        if (!grade) {
          errors.push({ row: row.rowNum, column: '직급코드', message: `직급코드 '${gradeCode}'를 찾을 수 없습니다`, severity: 'error' })
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
        errors.push({ row: row.rowNum, column: '새직급코드', message: `직급코드 '${gradeCode}'를 찾을 수 없습니다`, severity: 'error' })
        hasError = true
      } else if (currentAssignment.jobGrade) {
        // rankOrder 비교 (낮을수록 높은 직급)
        const currentGrade = await prisma.jobGrade.findUnique({
          where: { id: currentAssignment.jobGrade.id },
          select: { rankOrder: true },
        })
        if (currentGrade && grade.rankOrder >= currentGrade.rankOrder) {
          errors.push({ row: row.rowNum, column: '새직급코드', message: `새 직급이 현재 직급보다 높지 않습니다`, severity: 'warning' })
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
        errors.push({ row: row.rowNum, column: '전환법인코드', message: `법인코드 '${companyCode}'를 찾을 수 없습니다`, severity: 'error' })
        hasError = true
      }
      const deptCode = (row.raw['부서코드'] ?? '').trim()
      const dept = await prisma.department.findFirst({
        where: { code: deptCode, isActive: true },
        select: { id: true, name: true, companyId: true },
      })
      if (!dept) {
        errors.push({ row: row.rowNum, column: '부서코드', message: `부서코드 '${deptCode}'를 찾을 수 없습니다`, severity: 'error' })
        hasError = true
      } else if (company && dept.companyId !== company.id) {
        errors.push({ row: row.rowNum, column: '부서코드', message: `부서 '${deptCode}'가 법인 '${companyCode}'에 속하지 않습니다`, severity: 'error' })
        hasError = true
      }
      // 겸직 경고
      const secondaryCount = await prisma.employeeAssignment.count({
        where: { employeeId: employee.id, isPrimary: false, endDate: null },
      })
      if (secondaryCount > 0) {
        errors.push({ row: row.rowNum, column: '사번', message: `겸직 ${secondaryCount}건이 존재합니다. 법인전환 시 겸직 처리를 확인하세요`, severity: 'warning' })
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
        errors.push({ row: row.rowNum, column: '사번', message: `이미 퇴직 처리된 직원입니다`, severity: 'error' })
        hasError = true
      }
      currentValue = currentAssignment.status
      newValue = ['VOLUNTARY', 'RETIREMENT'].includes(resignType) ? 'RESIGNED' : 'TERMINATED'
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
  if (parts.length !== 2) return { valid: false, reason: '토큰 형식이 올바르지 않습니다' }

  const [originalHash, timestampStr] = parts
  const timestamp = parseInt(timestampStr, 10)
  if (isNaN(timestamp)) return { valid: false, reason: '토큰 타임스탬프가 올바르지 않습니다' }

  // 30분 만료
  const elapsed = Date.now() - timestamp
  if (elapsed > 30 * 60 * 1000) return { valid: false, reason: '검증 토큰이 만료되었습니다 (30분). 다시 검증해 주세요' }

  // 파일 해시 검증
  const currentHash = createHash('sha256')
    .update(Buffer.from(fileBuffer))
    .update(timestampStr)
    .digest('hex')

  if (currentHash !== originalHash) return { valid: false, reason: '파일이 검증 시점과 다릅니다. 다시 업로드해 주세요' }

  return { valid: true }
}
```

**Step 3: TypeScript 검증**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/lib/bulk-movement/parser.ts src/lib/bulk-movement/validator.ts
git commit -m "feat(bulk-movement): add CSV parser and validation engine with Gemini patches"
```

---

## Task 3: 실행기 (executor.ts)

**Files:**
- Create: `src/lib/bulk-movement/executor.ts`

**Step 1: executor.ts 작성**

```typescript
// src/lib/bulk-movement/executor.ts
import { prisma } from '@/lib/prisma'
import { parseDateOnly } from '@/lib/timezone'
import type { MovementType, ParsedRow } from './types'
import type { ChangeType } from '@/types/assignment'

/**
 * 검증된 CSV 행들을 트랜잭션 내에서 일괄 실행.
 * All-or-Nothing: 1건이라도 실패 시 전체 롤백.
 *
 * Gemini Patch 3: 트랜잭션 내에서 Re-validation 수행.
 */
export async function executeMovements(
  type: MovementType,
  rows: ParsedRow[],
  executedBy: string,
  userCompanyId: string,
  fileName: string,
): Promise<{ executionId: string; applied: number }> {
  const executionId = crypto.randomUUID()

  const applied = await prisma.$transaction(async (tx) => {
    let count = 0

    for (const row of rows) {
      const empNo = (row.raw['사번'] ?? '').trim()

      // ── Re-validation (Gemini Patch 3): 현재 상태 재확인 ──
      const employee = await tx.employee.findFirst({
        where: { employeeNo: empNo, deletedAt: null },
        select: { id: true },
      })
      if (!employee) throw new Error(`[Row ${row.rowNum}] 사번 '${empNo}'을 찾을 수 없습니다 (실행 시점 변경됨)`)

      const currentAssignment = await tx.employeeAssignment.findFirst({
        where: { employeeId: employee.id, isPrimary: true, endDate: null },
        include: { company: true, department: true, jobGrade: true },
      })
      if (!currentAssignment) throw new Error(`[Row ${row.rowNum}] 사번 '${empNo}'의 활성 발령이 없습니다 (실행 시점 변경됨)`)

      // 발효일 역전 재검증
      const dateStr = row.raw['발효일'] ?? row.raw['마지막근무일'] ?? ''
      if (dateStr) {
        const inputDate = parseDateOnly(dateStr)
        if (inputDate < currentAssignment.effectiveDate) {
          throw new Error(`[Row ${row.rowNum}] 발효일이 현재 발령보다 과거입니다 (실행 시점 변경됨)`)
        }
      }

      // ── 타입별 실행 ──
      await executeByType(tx, type, row, employee.id, currentAssignment, executedBy)
      count++
    }

    return count
  }, {
    timeout: 60000, // 60초 (대량 처리)
  })

  // 감사 로그 (트랜잭션 외부 — Patch 규칙 준수)
  await prisma.$executeRawUnsafe(
    `INSERT INTO bulk_movement_executions (id, company_id, movement_type, file_name, total_rows, applied_rows, status, executed_by, executed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
    executionId,
    userCompanyId,
    type,
    fileName,
    rows.length,
    applied,
    'COMPLETED',
    executedBy,
  )

  return { executionId, applied }
}

// ── 타입별 실행 로직 ──
type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
type AssignmentWithRelations = NonNullable<Awaited<ReturnType<typeof prisma.employeeAssignment.findFirst>>>
  & { company: { id: string; code: string; name: string }; department: { id: string; name: string; code: string } | null; jobGrade: { id: string; name: string; code: string } | null }

async function executeByType(
  tx: TxClient,
  type: MovementType,
  row: ParsedRow,
  employeeId: string,
  current: AssignmentWithRelations,
  approvedBy: string,
) {
  switch (type) {
    case 'transfer':
      return executeTransfer(tx, row, employeeId, current, approvedBy)
    case 'promotion':
      return executePromotion(tx, row, employeeId, current, approvedBy)
    case 'entity-transfer':
      return executeEntityTransfer(tx, row, employeeId, current, approvedBy)
    case 'termination':
      return executeTermination(tx, row, employeeId, current, approvedBy)
    case 'compensation':
      return executeCompensation(tx, row, employeeId, current, approvedBy)
  }
}

async function executeTransfer(
  tx: TxClient, row: ParsedRow, employeeId: string,
  current: AssignmentWithRelations, approvedBy: string,
) {
  const effectiveDate = parseDateOnly(row.raw['발효일'])
  const deptCode = (row.raw['부서코드'] ?? '').trim()
  const gradeCode = (row.raw['직급코드'] ?? '').trim()
  const posCode = (row.raw['직위코드'] ?? '').trim()
  const locCode = (row.raw['근무지코드'] ?? '').trim()

  const dept = await tx.department.findFirstOrThrow({ where: { code: deptCode, isActive: true }, select: { id: true, companyId: true } })
  const jobGradeId = gradeCode
    ? (await tx.jobGrade.findFirstOrThrow({ where: { code: gradeCode, deletedAt: null }, select: { id: true } })).id
    : current.jobGrade?.id
  const positionId = posCode
    ? (await tx.position.findFirstOrThrow({ where: { code: posCode, isActive: true }, select: { id: true } })).id
    : current.positionId
  const workLocationId = locCode
    ? (await tx.workLocation.findFirstOrThrow({ where: { code: locCode, deletedAt: null }, select: { id: true } })).id
    : current.workLocationId

  // Close current
  await tx.employeeAssignment.updateMany({
    where: { employeeId, isPrimary: true, endDate: null },
    data: { endDate: effectiveDate },
  })

  // Create new
  await tx.employeeAssignment.create({
    data: {
      employeeId,
      effectiveDate,
      endDate: null,
      changeType: 'TRANSFER' as ChangeType,
      companyId: dept.companyId,
      departmentId: dept.id,
      jobGradeId,
      jobCategoryId: current.jobCategoryId,
      employmentType: current.employmentType,
      status: current.status,
      positionId,
      workLocationId,
      isPrimary: true,
      reason: (row.raw['사유'] ?? '').trim() || undefined,
      approvedBy,
    },
  })
}

async function executePromotion(
  tx: TxClient, row: ParsedRow, employeeId: string,
  current: AssignmentWithRelations, approvedBy: string,
) {
  const effectiveDate = parseDateOnly(row.raw['발효일'])
  const gradeCode = (row.raw['새직급코드'] ?? '').trim()
  const posCode = (row.raw['직위코드'] ?? '').trim()

  const jobGrade = await tx.jobGrade.findFirstOrThrow({ where: { code: gradeCode, deletedAt: null }, select: { id: true } })
  const positionId = posCode
    ? (await tx.position.findFirstOrThrow({ where: { code: posCode, isActive: true }, select: { id: true } })).id
    : current.positionId

  await tx.employeeAssignment.updateMany({
    where: { employeeId, isPrimary: true, endDate: null },
    data: { endDate: effectiveDate },
  })

  await tx.employeeAssignment.create({
    data: {
      employeeId,
      effectiveDate,
      endDate: null,
      changeType: 'PROMOTION' as ChangeType,
      companyId: current.companyId,
      departmentId: current.departmentId,
      jobGradeId: jobGrade.id,
      jobCategoryId: current.jobCategoryId,
      employmentType: current.employmentType,
      status: current.status,
      positionId,
      workLocationId: current.workLocationId,
      isPrimary: true,
      reason: (row.raw['사유'] ?? '').trim() || undefined,
      approvedBy,
    },
  })
}

async function executeEntityTransfer(
  tx: TxClient, row: ParsedRow, employeeId: string,
  current: AssignmentWithRelations, approvedBy: string,
) {
  const effectiveDate = parseDateOnly(row.raw['발효일'])
  const companyCode = (row.raw['전환법인코드'] ?? '').trim()
  const deptCode = (row.raw['부서코드'] ?? '').trim()
  const gradeCode = (row.raw['직급코드'] ?? '').trim()
  const posCode = (row.raw['직위코드'] ?? '').trim()
  const empType = (row.raw['고용형태'] ?? '').trim()

  const company = await tx.company.findFirstOrThrow({ where: { code: companyCode, deletedAt: null }, select: { id: true } })
  const dept = await tx.department.findFirstOrThrow({ where: { code: deptCode, isActive: true }, select: { id: true } })
  const jobGradeId = gradeCode
    ? (await tx.jobGrade.findFirstOrThrow({ where: { code: gradeCode, deletedAt: null }, select: { id: true } })).id
    : current.jobGrade?.id
  const positionId = posCode
    ? (await tx.position.findFirstOrThrow({ where: { code: posCode, isActive: true }, select: { id: true } })).id
    : undefined

  await tx.employeeAssignment.updateMany({
    where: { employeeId, isPrimary: true, endDate: null },
    data: { endDate: effectiveDate },
  })

  await tx.employeeAssignment.create({
    data: {
      employeeId,
      effectiveDate,
      endDate: null,
      changeType: 'COMPANY_TRANSFER' as ChangeType,
      companyId: company.id,
      departmentId: dept.id,
      jobGradeId,
      jobCategoryId: current.jobCategoryId,
      employmentType: empType || current.employmentType,
      status: current.status,
      positionId,
      isPrimary: true,
      reason: (row.raw['사유'] ?? '').trim() || undefined,
      approvedBy,
    },
  })
}

async function executeTermination(
  tx: TxClient, row: ParsedRow, employeeId: string,
  current: AssignmentWithRelations, approvedBy: string,
) {
  const lastWorkingDate = parseDateOnly(row.raw['마지막근무일'])
  const resignType = (row.raw['퇴직구분'] ?? '').trim()

  // Gemini Patch 4: endDate = 마지막근무일, effectiveDate = 마지막근무일 + 1일
  const terminationEffectiveDate = new Date(lastWorkingDate)
  terminationEffectiveDate.setUTCDate(terminationEffectiveDate.getUTCDate() + 1)

  const changeType: ChangeType = ['VOLUNTARY', 'RETIREMENT'].includes(resignType) ? 'STATUS_CHANGE' : 'STATUS_CHANGE'
  const newStatus = ['VOLUNTARY', 'RETIREMENT'].includes(resignType) ? 'RESIGNED' : 'TERMINATED'

  // Close current assignment at lastWorkingDate
  await tx.employeeAssignment.updateMany({
    where: { employeeId, isPrimary: true, endDate: null },
    data: { endDate: lastWorkingDate },
  })

  // Create termination record (effectiveDate = lastWorkingDate + 1)
  await tx.employeeAssignment.create({
    data: {
      employeeId,
      effectiveDate: terminationEffectiveDate,
      endDate: null,
      changeType,
      companyId: current.companyId,
      departmentId: current.departmentId,
      jobGradeId: current.jobGrade?.id,
      jobCategoryId: current.jobCategoryId,
      employmentType: current.employmentType,
      status: newStatus,
      positionId: current.positionId,
      isPrimary: true,
      reason: (row.raw['퇴직사유상세'] ?? '').trim() || undefined,
      approvedBy,
    },
  })

  // EmployeeOffboarding 레코드 자동 생성
  await tx.employeeOffboarding.create({
    data: {
      employeeId,
      companyId: current.companyId,
      resignType,
      lastWorkingDate,
      resignReasonCode: (row.raw['퇴직사유코드'] ?? '').trim() || undefined,
      resignReasonDetail: (row.raw['퇴직사유상세'] ?? '').trim() || undefined,
      status: 'IN_PROGRESS',
      initiatedBy: approvedBy,
    },
  })
}

async function executeCompensation(
  tx: TxClient, row: ParsedRow, employeeId: string,
  current: AssignmentWithRelations, approvedBy: string,
) {
  const effectiveDate = parseDateOnly(row.raw['발효일'])
  const newBaseSalary = Number(row.raw['새기본급'])
  const changeType = row.raw['변경유형'] ?? 'OTHER'
  const currency = (row.raw['통화'] ?? '').trim()

  // 현재 급여 조회
  const latestComp = await tx.compensationHistory.findFirst({
    where: { employeeId },
    orderBy: { effectiveDate: 'desc' },
    select: { newBaseSalary: true, currency: true },
  })

  const previousBaseSalary = latestComp ? Number(latestComp.newBaseSalary) : 0
  const changePct = previousBaseSalary > 0
    ? ((newBaseSalary - previousBaseSalary) / previousBaseSalary) * 100
    : 0

  const resolvedCurrency = currency || latestComp?.currency || 'KRW'

  // SalaryBand 초과 여부
  let isException = false
  if (current.jobGrade) {
    const band = await tx.salaryBand.findFirst({
      where: {
        companyId: current.companyId,
        jobGradeId: current.jobGrade.id,
        deletedAt: null,
      },
      select: { minSalary: true, maxSalary: true },
    })
    if (band) {
      isException = newBaseSalary < Number(band.minSalary) || newBaseSalary > Number(band.maxSalary)
    }
  }

  await tx.compensationHistory.create({
    data: {
      employeeId,
      companyId: current.companyId,
      changeType,
      previousBaseSalary,
      newBaseSalary,
      currency: resolvedCurrency,
      changePct,
      effectiveDate,
      reason: (row.raw['사유'] ?? '').trim() || undefined,
      approvedBy,
      isException,
    },
  })
}
```

**Step 2: TypeScript 검증**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/lib/bulk-movement/executor.ts
git commit -m "feat(bulk-movement): add executor with All-or-Nothing transaction and re-validation"
```

---

## Task 4: API Routes (templates/validate/execute)

**Files:**
- Create: `src/app/api/v1/bulk-movements/templates/[type]/route.ts`
- Create: `src/app/api/v1/bulk-movements/validate/route.ts`
- Create: `src/app/api/v1/bulk-movements/execute/route.ts`

**Step 1: GET /templates/[type] — 템플릿 다운로드**

```typescript
// src/app/api/v1/bulk-movements/templates/[type]/route.ts
import { type NextRequest } from 'next/server'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { badRequest, forbidden } from '@/lib/errors'
import { isValidMovementType } from '@/lib/bulk-movement/types'
import { getTemplate } from '@/lib/bulk-movement/templates'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (
    _req: NextRequest,
    context: { params: Promise<{ type: string }> },
    user: SessionUser,
  ) => {
    const { type } = await context.params
    if (!isValidMovementType(type)) throw badRequest(`알 수 없는 이동 유형: ${type}`)

    const template = getTemplate(type)

    // SUPER_ADMIN 전용 체크 (Gemini Patch 1)
    if (template.superAdminOnly && user.role !== ROLE.SUPER_ADMIN) {
      throw forbidden('법인전환은 SUPER_ADMIN만 사용할 수 있습니다')
    }

    // CSV 생성 (UTF-8 BOM + 헤더 + 예시 1행)
    const bom = '\uFEFF'
    const headers = template.columns.map(c => c.key).join(',')
    const example = template.columns.map(c => template.exampleRow[c.key] ?? '').join(',')
    const csv = bom + headers + '\n' + example + '\n'

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="bulk-${type}-template.csv"`,
      },
    })
  },
  perm(MODULE.EMPLOYEES, ACTION.APPROVE),
)
```

**Step 2: POST /validate — 업로드 + 검증**

```typescript
// src/app/api/v1/bulk-movements/validate/route.ts
import { type NextRequest } from 'next/server'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { badRequest, forbidden } from '@/lib/errors'
import { apiSuccess } from '@/lib/api'
import { isValidMovementType } from '@/lib/bulk-movement/types'
import { getTemplate } from '@/lib/bulk-movement/templates'
import { parseCSV, validateHeaders } from '@/lib/bulk-movement/parser'
import { validateRows } from '@/lib/bulk-movement/validator'
import type { SessionUser } from '@/types'

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const type = formData.get('type') as string | null

    if (!file) throw badRequest('파일이 필요합니다')
    if (!type || !isValidMovementType(type)) throw badRequest('올바른 이동 유형을 선택해 주세요')

    const template = getTemplate(type)

    // SUPER_ADMIN 전용 체크
    if (template.superAdminOnly && user.role !== ROLE.SUPER_ADMIN) {
      throw forbidden('법인전환은 SUPER_ADMIN만 사용할 수 있습니다')
    }

    const buffer = await file.arrayBuffer()

    // CSV 파싱
    let rows
    try {
      rows = parseCSV(buffer)
    } catch {
      throw badRequest('CSV 파일을 파싱할 수 없습니다. UTF-8 인코딩인지 확인해 주세요')
    }

    if (rows.length === 0) throw badRequest('데이터가 없습니다')
    if (rows.length > 500) throw badRequest('한 번에 최대 500건까지 업로드 가능합니다')

    // 헤더 검증
    const parsedHeaders = Object.keys(rows[0].raw)
    const missingHeaders = validateHeaders(parsedHeaders, template.columns)
    if (missingHeaders.length > 0) {
      throw badRequest(`필수 컬럼이 누락되었습니다: ${missingHeaders.join(', ')}`)
    }

    // SUPER_ADMIN은 전체 법인 처리 가능 → companyId 제한 해제
    const userCompanyId = user.role === ROLE.SUPER_ADMIN ? '' : user.companyId

    const result = await validateRows(rows, template, userCompanyId, buffer)
    return apiSuccess(result)
  },
  perm(MODULE.EMPLOYEES, ACTION.APPROVE),
)
```

**Step 3: POST /execute — 실행**

```typescript
// src/app/api/v1/bulk-movements/execute/route.ts
import { type NextRequest } from 'next/server'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { badRequest, forbidden } from '@/lib/errors'
import { apiSuccess } from '@/lib/api'
import { isValidMovementType } from '@/lib/bulk-movement/types'
import { getTemplate } from '@/lib/bulk-movement/templates'
import { parseCSV } from '@/lib/bulk-movement/parser'
import { verifyValidationToken } from '@/lib/bulk-movement/validator'
import { executeMovements } from '@/lib/bulk-movement/executor'
import type { SessionUser } from '@/types'

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const type = formData.get('type') as string | null
    const validationToken = formData.get('validationToken') as string | null

    if (!file) throw badRequest('파일이 필요합니다')
    if (!type || !isValidMovementType(type)) throw badRequest('올바른 이동 유형을 선택해 주세요')
    if (!validationToken) throw badRequest('검증 토큰이 필요합니다. 먼저 검증을 수행해 주세요')

    const template = getTemplate(type)
    if (template.superAdminOnly && user.role !== ROLE.SUPER_ADMIN) {
      throw forbidden('법인전환은 SUPER_ADMIN만 사용할 수 있습니다')
    }

    const buffer = await file.arrayBuffer()

    // 토큰 검증
    const tokenCheck = verifyValidationToken(validationToken, buffer)
    if (!tokenCheck.valid) throw badRequest(tokenCheck.reason ?? '토큰 검증 실패')

    // CSV 재파싱
    const rows = parseCSV(buffer)
    if (rows.length === 0) throw badRequest('데이터가 없습니다')

    const userCompanyId = user.role === ROLE.SUPER_ADMIN ? '' : user.companyId

    try {
      const result = await executeMovements(type, rows, user.employeeId, userCompanyId, file.name)
      return apiSuccess({ success: true, ...result })
    } catch (error) {
      // 트랜잭션 롤백된 경우 (Re-validation 실패 등)
      const message = error instanceof Error ? error.message : '실행 중 오류가 발생했습니다'
      throw badRequest(`실행 실패 (전체 롤백됨): ${message}`)
    }
  },
  perm(MODULE.EMPLOYEES, ACTION.APPROVE),
)
```

**Step 4: TypeScript 검증**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/app/api/v1/bulk-movements/
git commit -m "feat(bulk-movement): add 3 API routes (templates/validate/execute)"
```

---

## Task 5: UI — 3-Step Wizard

**Files:**
- Create: `src/app/[locale]/(dashboard)/hr/bulk-movements/page.tsx`
- Create: `src/app/[locale]/(dashboard)/hr/bulk-movements/BulkMovementsClient.tsx`
- Create: `src/app/[locale]/(dashboard)/hr/bulk-movements/components/TypeSelector.tsx`
- Create: `src/app/[locale]/(dashboard)/hr/bulk-movements/components/FileUploader.tsx`
- Create: `src/app/[locale]/(dashboard)/hr/bulk-movements/components/ValidationPreview.tsx`
- Create: `src/app/[locale]/(dashboard)/hr/bulk-movements/components/ExecutionConfirm.tsx`

**Step 1: Server page**

```typescript
// src/app/[locale]/(dashboard)/hr/bulk-movements/page.tsx
import { Suspense } from 'react'
import BulkMovementsClient from './BulkMovementsClient'

export default function BulkMovementsPage() {
  return (
    <Suspense fallback={<div className="p-6">로딩 중...</div>}>
      <BulkMovementsClient />
    </Suspense>
  )
}
```

**Step 2: BulkMovementsClient.tsx (메인 위자드)**

3-step state machine으로 구현. `useState`로 step 관리.

```typescript
// src/app/[locale]/(dashboard)/hr/bulk-movements/BulkMovementsClient.tsx
'use client'

import { useState, useCallback } from 'react'
import type { MovementType, ValidateResponse } from '@/lib/bulk-movement/types'
import { TypeSelector } from './components/TypeSelector'
import { FileUploader } from './components/FileUploader'
import { ValidationPreview } from './components/ValidationPreview'
import { ExecutionConfirm } from './components/ExecutionConfirm'

type Step = 'select' | 'upload' | 'confirm'

export default function BulkMovementsClient() {
  const [step, setStep] = useState<Step>('select')
  const [selectedType, setSelectedType] = useState<MovementType | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [validateResult, setValidateResult] = useState<ValidateResponse | null>(null)

  const handleTypeSelect = useCallback((type: MovementType) => {
    setSelectedType(type)
    setStep('upload')
    setFile(null)
    setValidateResult(null)
  }, [])

  const handleValidateComplete = useCallback((result: ValidateResponse, uploadedFile: File) => {
    setValidateResult(result)
    setFile(uploadedFile)
    if (result.valid) {
      setStep('confirm')
    }
  }, [])

  const handleExecuteComplete = useCallback(() => {
    // 실행 완료 → 초기화
    setStep('select')
    setSelectedType(null)
    setFile(null)
    setValidateResult(null)
  }, [])

  const handleBack = useCallback(() => {
    if (step === 'upload') {
      setStep('select')
      setSelectedType(null)
    } else if (step === 'confirm') {
      setStep('upload')
    }
  }, [step])

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="mb-6 text-2xl font-bold">대량 인사이동</h1>

      {/* Step indicator */}
      <div className="mb-8 flex items-center gap-2 text-sm">
        <StepBadge num={1} label="유형 선택" active={step === 'select'} done={step !== 'select'} />
        <span className="text-muted-foreground">→</span>
        <StepBadge num={2} label="업로드/검증" active={step === 'upload'} done={step === 'confirm'} />
        <span className="text-muted-foreground">→</span>
        <StepBadge num={3} label="실행" active={step === 'confirm'} done={false} />
      </div>

      {step === 'select' && (
        <TypeSelector onSelect={handleTypeSelect} />
      )}

      {step === 'upload' && selectedType && (
        <div>
          <FileUploader
            type={selectedType}
            onValidateComplete={handleValidateComplete}
          />
          {validateResult && !validateResult.valid && (
            <ValidationPreview result={validateResult} />
          )}
          <button
            onClick={handleBack}
            className="mt-4 text-sm text-muted-foreground hover:underline"
          >
            ← 유형 선택으로 돌아가기
          </button>
        </div>
      )}

      {step === 'confirm' && selectedType && file && validateResult && (
        <ExecutionConfirm
          type={selectedType}
          file={file}
          validateResult={validateResult}
          onComplete={handleExecuteComplete}
          onBack={handleBack}
        />
      )}
    </div>
  )
}

function StepBadge({ num, label, active, done }: { num: number; label: string; active: boolean; done: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full px-3 py-1',
      active && 'bg-primary text-primary-foreground',
      done && 'bg-muted text-muted-foreground',
      !active && !done && 'bg-muted/50 text-muted-foreground/50',
    )}>
      <span className="text-xs font-medium">{num}</span>
      <span>{label}</span>
    </span>
  )
}

// cn import
import { cn } from '@/lib/utils'
```

**Step 3: TypeSelector.tsx**

```typescript
// src/app/[locale]/(dashboard)/hr/bulk-movements/components/TypeSelector.tsx
'use client'

import { ArrowRightLeft, TrendingUp, Building2, DoorOpen, Coins, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MovementType } from '@/lib/bulk-movement/types'
import { useState } from 'react'

const TYPE_CARDS: Array<{
  type: MovementType
  label: string
  description: string
  icon: typeof ArrowRightLeft
}> = [
  { type: 'transfer', label: '부서이동', description: '부서/직급/직위/근무지 변경', icon: ArrowRightLeft },
  { type: 'promotion', label: '승진', description: '직급 상향 발령', icon: TrendingUp },
  { type: 'entity-transfer', label: '법인전환', description: '타법인 전환 (SUPER_ADMIN 전용)', icon: Building2 },
  { type: 'termination', label: '퇴직', description: '퇴직/퇴사 처리', icon: DoorOpen },
  { type: 'compensation', label: '급여변경', description: '기본급 변경', icon: Coins },
]

interface TypeSelectorProps {
  onSelect: (type: MovementType) => void
}

export function TypeSelector({ onSelect }: TypeSelectorProps) {
  const [selected, setSelected] = useState<MovementType | null>(null)

  const handleDownloadTemplate = () => {
    if (!selected) return
    window.open(`/api/v1/bulk-movements/templates/${selected}`, '_blank')
  }

  return (
    <div>
      <p className="mb-4 text-muted-foreground">이동 유형을 선택하세요</p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {TYPE_CARDS.map(({ type, label, description, icon: Icon }) => (
          <button
            key={type}
            onClick={() => setSelected(type)}
            className={cn(
              'flex flex-col items-center gap-2 rounded-lg border p-6 text-center transition-colors hover:border-primary',
              selected === type && 'border-primary bg-primary/5 ring-1 ring-primary',
            )}
          >
            <Icon className="h-8 w-8" />
            <span className="font-medium">{label}</span>
            <span className="text-xs text-muted-foreground">{description}</span>
          </button>
        ))}
      </div>

      {selected && (
        <div className="mt-6 flex items-center gap-4">
          <span className="text-sm">
            선택한 유형: <strong>{TYPE_CARDS.find(c => c.type === selected)?.label}</strong>
          </span>
          <button
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
          >
            <Download className="h-4 w-4" />
            템플릿 다운로드
          </button>
          <button
            onClick={() => onSelect(selected)}
            className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
          >
            다음 →
          </button>
        </div>
      )}
    </div>
  )
}
```

**Step 4: FileUploader.tsx**

```typescript
// src/app/[locale]/(dashboard)/hr/bulk-movements/components/FileUploader.tsx
'use client'

import { useState, useCallback, useRef } from 'react'
import { Upload, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MovementType, ValidateResponse } from '@/lib/bulk-movement/types'

interface FileUploaderProps {
  type: MovementType
  onValidateComplete: (result: ValidateResponse, file: File) => void
}

export function FileUploader({ type, onValidateComplete }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setError('CSV 파일만 업로드 가능합니다')
      return
    }
    setError(null)
    setIsValidating(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', type)

      const res = await fetch('/api/v1/bulk-movements/validate', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json()
        setError(err.error?.message ?? '검증 중 오류가 발생했습니다')
        return
      }

      const json = await res.json()
      onValidateComplete(json.data, file)
    } catch {
      setError('서버 연결에 실패했습니다')
    } finally {
      setIsValidating(false)
    }
  }, [type, onValidateComplete])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed p-12 transition-colors',
          isDragging && 'border-primary bg-primary/5',
          !isDragging && 'border-muted-foreground/25 hover:border-muted-foreground/50',
        )}
      >
        {isValidating ? (
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        ) : (
          <Upload className="h-10 w-10 text-muted-foreground" />
        )}
        <p className="text-sm text-muted-foreground">
          {isValidating ? '검증 중...' : 'CSV 파일을 여기에 드래그하거나 클릭하여 선택하세요'}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          onChange={handleInputChange}
          className="hidden"
        />
      </div>

      {error && (
        <p className="mt-3 text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}
```

**Step 5: ValidationPreview.tsx**

```typescript
// src/app/[locale]/(dashboard)/hr/bulk-movements/components/ValidationPreview.tsx
'use client'

import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ValidateResponse } from '@/lib/bulk-movement/types'

interface ValidationPreviewProps {
  result: ValidateResponse
}

export function ValidationPreview({ result }: ValidationPreviewProps) {
  const errorCount = result.errors.filter(e => e.severity === 'error').length
  const warningCount = result.errors.filter(e => e.severity === 'warning').length

  return (
    <div className="mt-6 space-y-4">
      {/* Summary */}
      <div className={cn(
        'flex items-center gap-2 rounded-lg p-3',
        result.valid ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800',
      )}>
        {result.valid ? (
          <CheckCircle2 className="h-5 w-5" />
        ) : (
          <AlertCircle className="h-5 w-5" />
        )}
        <span className="text-sm font-medium">
          {result.valid
            ? `검증 완료: ${result.totalRows}건 모두 정상`
            : `검증 실패: ${result.totalRows}건 중 ${errorCount}건 에러`}
          {warningCount > 0 && `, ${warningCount}건 경고`}
        </span>
      </div>

      {/* Error list */}
      {result.errors.length > 0 && (
        <div className="max-h-48 overflow-y-auto rounded border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted">
              <tr>
                <th className="px-3 py-2 text-left">행</th>
                <th className="px-3 py-2 text-left">컬럼</th>
                <th className="px-3 py-2 text-left">메시지</th>
                <th className="px-3 py-2 text-left">유형</th>
              </tr>
            </thead>
            <tbody>
              {result.errors.map((err, i) => (
                <tr key={i} className="border-t">
                  <td className="px-3 py-1.5">{err.row}</td>
                  <td className="px-3 py-1.5">{err.column}</td>
                  <td className="px-3 py-1.5">{err.message}</td>
                  <td className="px-3 py-1.5">
                    {err.severity === 'error' ? (
                      <span className="inline-flex items-center gap-1 text-red-600">
                        <AlertCircle className="h-3.5 w-3.5" /> 에러
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-600">
                        <AlertTriangle className="h-3.5 w-3.5" /> 경고
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Preview table */}
      <div className="max-h-64 overflow-y-auto rounded border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted">
            <tr>
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">사번</th>
              <th className="px-3 py-2 text-left">이름</th>
              <th className="px-3 py-2 text-left">현재</th>
              <th className="px-3 py-2 text-left">변경</th>
              <th className="px-3 py-2 text-left">상태</th>
            </tr>
          </thead>
          <tbody>
            {result.preview.map((row) => (
              <tr key={row.rowNum} className="border-t">
                <td className="px-3 py-1.5">{row.rowNum}</td>
                <td className="px-3 py-1.5 font-mono text-xs">{row.employeeNo}</td>
                <td className="px-3 py-1.5">{row.employeeName}</td>
                <td className="px-3 py-1.5">{row.currentValue}</td>
                <td className="px-3 py-1.5">{row.newValue}</td>
                <td className="px-3 py-1.5">
                  {row.status === 'valid' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                  {row.status === 'error' && <AlertCircle className="h-4 w-4 text-red-600" />}
                  {row.status === 'warning' && <AlertTriangle className="h-4 w-4 text-amber-600" />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

**Step 6: ExecutionConfirm.tsx**

```typescript
// src/app/[locale]/(dashboard)/hr/bulk-movements/components/ExecutionConfirm.tsx
'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import type { MovementType, ValidateResponse } from '@/lib/bulk-movement/types'

const TYPE_LABELS: Record<MovementType, string> = {
  'transfer': '부서이동',
  'promotion': '승진',
  'entity-transfer': '법인전환',
  'termination': '퇴직',
  'compensation': '급여변경',
}

interface ExecutionConfirmProps {
  type: MovementType
  file: File
  validateResult: ValidateResponse
  onComplete: () => void
  onBack: () => void
}

export function ExecutionConfirm({ type, file, validateResult, onComplete, onBack }: ExecutionConfirmProps) {
  const [isExecuting, setIsExecuting] = useState(false)
  const [result, setResult] = useState<{ success: boolean; applied?: number; error?: string } | null>(null)

  const warningCount = validateResult.errors.filter(e => e.severity === 'warning').length

  const handleExecute = async () => {
    if (!validateResult.validationToken) return
    setIsExecuting(true)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', type)
      formData.append('validationToken', validateResult.validationToken)

      const res = await fetch('/api/v1/bulk-movements/execute', {
        method: 'POST',
        body: formData,
      })

      const json = await res.json()
      if (!res.ok) {
        setResult({ success: false, error: json.error?.message ?? '실행 중 오류가 발생했습니다' })
      } else {
        setResult({ success: true, applied: json.data.applied })
      }
    } catch {
      setResult({ success: false, error: '서버 연결에 실패했습니다' })
    } finally {
      setIsExecuting(false)
    }
  }

  if (result?.success) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-8 text-center">
        <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-600" />
        <h2 className="mb-2 text-lg font-bold text-green-800">실행 완료</h2>
        <p className="text-sm text-green-700">{result.applied}건이 성공적으로 처리되었습니다.</p>
        <button
          onClick={onComplete}
          className="mt-6 rounded-md bg-primary px-6 py-2 text-sm text-primary-foreground hover:bg-primary/90"
        >
          완료
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-lg border p-6">
      <h2 className="mb-4 text-lg font-bold">실행 확인</h2>

      <div className="mb-6 space-y-2 text-sm">
        <p>⚠️ 다음 인사이동을 실행하시겠습니까?</p>
        <ul className="ml-4 list-disc space-y-1 text-muted-foreground">
          <li>유형: <strong>{TYPE_LABELS[type]}</strong></li>
          <li>대상: <strong>{validateResult.validRows}명</strong></li>
          {warningCount > 0 && (
            <li className="text-amber-600">경고: {warningCount}건</li>
          )}
        </ul>
      </div>

      <div className="mb-6 flex items-start gap-2 rounded bg-amber-50 p-3 text-sm text-amber-800">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-medium">이 작업은 되돌릴 수 없습니다.</p>
          <p>모든 대상 직원의 발령이력에 새 레코드가 추가됩니다.</p>
        </div>
      </div>

      {result?.error && (
        <p className="mb-4 text-sm text-destructive">{result.error}</p>
      )}

      <div className="flex justify-end gap-3">
        <button
          onClick={onBack}
          disabled={isExecuting}
          className="rounded-md border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
        >
          ← 수정
        </button>
        <button
          onClick={handleExecute}
          disabled={isExecuting || !validateResult.validationToken}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isExecuting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              실행 중...
            </>
          ) : (
            '✅ 실행'
          )}
        </button>
      </div>
    </div>
  )
}
```

**Step 7: TypeScript 검증**

```bash
npx tsc --noEmit
```

**Step 8: Commit**

```bash
git add src/app/\[locale\]/\(dashboard\)/hr/bulk-movements/
git commit -m "feat(bulk-movement): add 3-step wizard UI (TypeSelector, FileUploader, ValidationPreview, ExecutionConfirm)"
```

---

## Task 6: DB 마이그레이션 (BulkMovementExecution 테이블)

**Files:**
- Create: Prisma migration for `bulk_movement_executions` table

**Step 1: Raw SQL 마이그레이션 생성**

executor.ts에서 `$executeRawUnsafe`로 직접 INSERT 하므로 Prisma schema는 수정하지 않음 (DO NOT TOUCH 규칙).
대신 수동 마이그레이션으로 테이블만 생성.

```bash
npx prisma migrate dev --create-only --name add_bulk_movement_executions
```

생성된 마이그레이션 파일에 아래 SQL 입력:

```sql
CREATE TABLE IF NOT EXISTS bulk_movement_executions (
  id VARCHAR(36) PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL,
  movement_type VARCHAR(50) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  total_rows INTEGER NOT NULL,
  applied_rows INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
  executed_by VARCHAR(36) NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  error_details JSONB,
  CONSTRAINT fk_bme_company FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT fk_bme_executor FOREIGN KEY (executed_by) REFERENCES employees(id)
);

CREATE INDEX idx_bme_company ON bulk_movement_executions(company_id);
CREATE INDEX idx_bme_executed_at ON bulk_movement_executions(executed_at);
```

**Step 2: 마이그레이션 실행**

```bash
npx prisma migrate dev
```

**Step 3: Commit**

```bash
git add prisma/migrations/
git commit -m "feat(bulk-movement): add bulk_movement_executions audit table"
```

---

## Task 7: TypeScript 검증 + lint + 수동 테스트

**Step 1: 전체 TypeScript 검증**

```bash
npx tsc --noEmit
```
Expected: 0 errors

**Step 2: Lint**

```bash
npm run lint
```
Expected: no new warnings

**Step 3: 에러 수정 (있을 경우)**

타입 에러나 lint 에러가 있으면 수정 후 재검증.

**Step 4: 개발 서버 확인**

```bash
npm run dev
```

브라우저에서 `http://localhost:3002/ko/hr/bulk-movements` 접속하여:
1. 유형 선택 카드 5개 렌더링 확인
2. 템플릿 다운로드 동작 확인
3. CSV 업로드 → 검증 → 프리뷰 → 실행 플로우 확인

**Step 5: Commit (최종)**

```bash
git add .
git commit -m "feat(bulk-movement): Phase 3.5 B-5a complete — bulk HR movements CSV import"
```

---

## Dependencies Between Tasks

```
Task 1 (types/templates) → Task 2 (parser/validator) → Task 3 (executor)
                                                              ↓
Task 1 ──────────────────→ Task 4 (API routes) ← Task 2, Task 3
                                     ↓
                            Task 5 (UI) ← Task 4
Task 6 (DB migration) — independent, can run in parallel with Task 4-5
Task 7 (verification) — depends on all above
```

**총 예상 시간:** Task 1-3 (백엔드 코어) → Task 4 (API) → Task 5 (UI) → Task 6 (DB) → Task 7 (검증)
