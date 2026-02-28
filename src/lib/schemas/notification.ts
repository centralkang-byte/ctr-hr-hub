import { z } from 'zod'
import { paginationSchema } from './common'

// ================================================================
// Notification List (내 알림 조회)
// ================================================================
export const notificationListSchema = paginationSchema.extend({
  isRead: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  triggerType: z.string().optional(),
})

export type NotificationListInput = z.infer<typeof notificationListSchema>

// ================================================================
// Notification Trigger (알림 트리거 관리)
// ================================================================
export const notificationTriggerCreateSchema = z.object({
  eventType: z.string().min(1, '이벤트 타입은 필수입니다').max(100),
  template: z.string().min(1, '템플릿은 필수입니다').max(2000),
  channels: z
    .array(z.enum(['IN_APP', 'EMAIL', 'PUSH']))
    .min(1, '최소 1개 채널을 선택하세요'),
  isActive: z.boolean().default(true),
})

export type NotificationTriggerCreateInput = z.infer<typeof notificationTriggerCreateSchema>

export const notificationTriggerUpdateSchema = z.object({
  eventType: z.string().min(1).max(100).optional(),
  template: z.string().min(1).max(2000).optional(),
  channels: z.array(z.enum(['IN_APP', 'EMAIL', 'PUSH'])).min(1).optional(),
  isActive: z.boolean().optional(),
})

export type NotificationTriggerUpdateInput = z.infer<typeof notificationTriggerUpdateSchema>
