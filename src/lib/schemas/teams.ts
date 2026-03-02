// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Teams Integration Zod Schemas
// ═══════════════════════════════════════════════════════════

import { z } from 'zod'

// ─── Teams Config ───────────────────────────────────────────

export const teamsConfigSchema = z.object({
  tenantId: z.string().min(1, 'Tenant ID는 필수입니다').optional(),
  teamId: z.string().nullable().optional(),
  channelId: z.string().nullable().optional(),
  webhookUrl: z.string().url().nullable().optional(),
  botEnabled: z.boolean().optional(),
  presenceSync: z.boolean().optional(),
  digestEnabled: z.boolean().optional(),
  digestDay: z.number().int().min(0).max(6).optional(),
  digestHour: z.number().int().min(0).max(23).optional(),
})

export type TeamsConfigInput = z.infer<typeof teamsConfigSchema>

// ─── Card Action (webhook payload) ──────────────────────────

export const teamsCardActionSchema = z.object({
  action: z.string().min(1),
  cardType: z.string().min(1),
  referenceId: z.string().min(1),
})

export type TeamsCardActionInput = z.infer<typeof teamsCardActionSchema>

// ─── Bot Activity ───────────────────────────────────────────

export const botActivitySchema = z.object({
  type: z.string(),
  id: z.string().optional(),
  timestamp: z.string().optional(),
  from: z.object({
    id: z.string(),
    name: z.string().optional(),
    aadObjectId: z.string().optional(),
  }),
  conversation: z.object({
    id: z.string(),
    conversationType: z.string().optional(),
    tenantId: z.string().optional(),
  }),
  recipient: z
    .object({
      id: z.string(),
      name: z.string().optional(),
    })
    .optional(),
  text: z.string().optional(),
  value: z.record(z.string(), z.unknown()).optional(),
  serviceUrl: z.string().optional(),
  channelId: z.string().optional(),
})

export type BotActivityInput = z.infer<typeof botActivitySchema>

// ─── Digest Config ──────────────────────────────────────────

export const digestConfigSchema = z.object({
  digestEnabled: z.boolean(),
  digestDay: z.number().int().min(0).max(6),
  digestHour: z.number().int().min(0).max(23),
})

export type DigestConfigInput = z.infer<typeof digestConfigSchema>

// ─── Teams Recognition (via Bot) ────────────────────────────

export const teamsRecognitionSchema = z.object({
  receiverAadId: z.string().min(1, '받는 사람 ID는 필수입니다'),
  value: z.string().min(1, '핵심가치를 선택하세요'),
  message: z.string().min(1, '칭찬 메시지를 입력하세요').max(500),
})

export type TeamsRecognitionInput = z.infer<typeof teamsRecognitionSchema>
