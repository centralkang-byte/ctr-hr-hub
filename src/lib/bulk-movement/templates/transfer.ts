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
