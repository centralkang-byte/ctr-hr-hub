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

export interface TemplateColumn {
  key: string
  field: string
  required: boolean
  description: string
  example: string
}

export interface ValidationRow {
  rowNum: number
  employeeNo: string
  employeeName: string
  currentValue: string
  newValue: string
  status: 'valid' | 'error' | 'warning'
}

export interface ValidationError {
  row: number
  column: string
  message: string
  severity: 'error' | 'warning'
}

export interface ValidateResponse {
  valid: boolean
  totalRows: number
  validRows: number
  errors: ValidationError[]
  preview: ValidationRow[]
  validationToken: string | null
}

export interface ExecuteResponse {
  success: boolean
  applied: number
  executionId: string
}

export interface ParsedRow {
  rowNum: number
  raw: Record<string, string>
}

export interface ValidatedRow {
  rowNum: number
  employeeId: string
  employeeNo: string
  employeeName: string
  data: Record<string, unknown>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface MovementTemplate {
  type: MovementType
  label: string
  description: string
  superAdminOnly: boolean
  columns: TemplateColumn[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rowSchema: z.ZodType<any>
  exampleRow: Record<string, string>
}
