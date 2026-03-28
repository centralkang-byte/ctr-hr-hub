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
  변경유형: z.enum(COMP_CHANGE_TYPES, { error: '변경유형이 올바르지 않습니다' }),
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
