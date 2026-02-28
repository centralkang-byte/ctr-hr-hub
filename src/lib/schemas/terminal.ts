import { z } from 'zod'
import { paginationSchema } from './common'

// ================================================================
// Terminal CRUD
// ================================================================
export const terminalCreateSchema = z.object({
  terminalCode: z.string().min(1, '단말기 코드는 필수입니다').max(50),
  terminalType: z.enum(['FINGERPRINT', 'CARD_READER', 'FACE_RECOGNITION']),
  locationName: z.string().min(1, '설치 위치는 필수입니다').max(200),
  ipAddress: z
    .string()
    .regex(/^(\d{1,3}\.){3}\d{1,3}$/, '유효한 IP 주소를 입력하세요')
    .optional(),
})

export type TerminalCreateInput = z.infer<typeof terminalCreateSchema>

export const terminalUpdateSchema = z.object({
  terminalType: z.enum(['FINGERPRINT', 'CARD_READER', 'FACE_RECOGNITION']).optional(),
  locationName: z.string().min(1).max(200).optional(),
  ipAddress: z
    .string()
    .regex(/^(\d{1,3}\.){3}\d{1,3}$/, '유효한 IP 주소를 입력하세요')
    .optional(),
  isActive: z.boolean().optional(),
})

export type TerminalUpdateInput = z.infer<typeof terminalUpdateSchema>

// ================================================================
// Terminal Clock Event (from device)
// ================================================================
export const terminalClockSchema = z.object({
  employeeNo: z.string().min(1),
  eventType: z.enum(['CLOCK_IN', 'CLOCK_OUT']),
  timestamp: z.string().datetime(),
  verificationMethod: z.enum(['FINGERPRINT', 'CARD', 'QR', 'FACE']).optional(),
})

export type TerminalClockInput = z.infer<typeof terminalClockSchema>

// ================================================================
// Terminal Search
// ================================================================
export const terminalSearchSchema = paginationSchema.extend({
  terminalType: z.enum(['FINGERPRINT', 'CARD_READER', 'FACE_RECOGNITION']).optional(),
  isActive: z.coerce.boolean().optional(),
})

export type TerminalSearchInput = z.infer<typeof terminalSearchSchema>
