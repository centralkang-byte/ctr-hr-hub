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
  퇴직구분: z.enum(RESIGN_TYPES, { error: '퇴직구분은 VOLUNTARY/INVOLUNTARY/RETIREMENT/CONTRACT_END 중 하나여야 합니다' }),
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
