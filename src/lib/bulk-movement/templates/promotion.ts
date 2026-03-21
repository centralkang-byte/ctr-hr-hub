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
