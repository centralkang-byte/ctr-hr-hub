import { z } from 'zod'
import { paginationSchema } from './common'

// ================================================================
// Leave Policy CRUD
// ================================================================
export const leavePolicyCreateSchema = z.object({
  name: z.string().min(1, '정책명은 필수입니다').max(100),
  leaveType: z.string().min(1).max(50),
  defaultDays: z.number().int().min(0).max(365),
  isPaid: z.boolean(),
  carryOverAllowed: z.boolean(),
  maxCarryOverDays: z.number().int().min(0).max(365).optional(),
  minTenureMonths: z.number().int().min(0).optional(),
  minUnit: z.enum(['FULL_DAY', 'HALF_DAY', 'QUARTER_DAY']).default('FULL_DAY'),
})

export type LeavePolicyCreateInput = z.infer<typeof leavePolicyCreateSchema>

export const leavePolicyUpdateSchema = leavePolicyCreateSchema.partial()

export type LeavePolicyUpdateInput = z.infer<typeof leavePolicyUpdateSchema>

// ================================================================
// Leave Request
// ================================================================
export const leaveRequestCreateSchema = z
  .object({
    policyId: z.string().uuid('정책 ID가 올바르지 않습니다'),
    startDate: z.string().date(),
    endDate: z.string().date(),
    days: z.number().min(0.25).max(365),
    halfDayType: z.enum(['AM', 'PM']).optional(),
    reason: z.string().min(1, '사유를 입력해주세요').max(1000),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: '종료일은 시작일 이후여야 합니다',
    path: ['endDate'],
  })

export type LeaveRequestCreateInput = z.infer<typeof leaveRequestCreateSchema>

// ================================================================
// Leave Approval / Rejection
// ================================================================
export const leaveApprovalSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  rejectionReason: z.string().max(500).optional(),
})

export type LeaveApprovalInput = z.infer<typeof leaveApprovalSchema>

// ================================================================
// Leave Balance Bulk Grant
// ================================================================
export const leaveBalanceBulkGrantSchema = z.object({
  policyId: z.string().uuid(),
  year: z.number().int().min(2020).max(2100),
  employeeIds: z.array(z.string().uuid()).min(1, '직원을 선택해주세요'),
  days: z.number().min(0.5).max(365),
})

export type LeaveBalanceBulkGrantInput = z.infer<typeof leaveBalanceBulkGrantSchema>

// ================================================================
// Leave Search
// ================================================================
export const leaveSearchSchema = paginationSchema.extend({
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(),
  leaveType: z.string().optional(),
  employeeId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
})

export type LeaveSearchInput = z.infer<typeof leaveSearchSchema>
