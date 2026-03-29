import { z } from 'zod'
import type { MovementTemplate, TemplateColumn } from '../types'

const columns: TemplateColumn[] = [
  { key: '사번', field: 'employeeNo', required: true, description: '직원 사번', example: 'EMP001' },
  { key: '전환법인코드', field: 'targetCompanyCode', required: true, description: '전환할 법인 코드', example: 'CTR-CN' },
  { key: '부서코드', field: 'departmentCode', required: true, description: '새 법인의 부서 코드', example: 'CN-DEV-01' },
  { key: '직급코드', field: 'jobGradeCode', required: false, description: '새 법인의 직급 코드', example: 'L2' },
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
