// ═══════════════════════════════════════════════════════════
// CTR HR Hub — M365 Provisioning Zod Schemas
// ═══════════════════════════════════════════════════════════

import { z } from 'zod'
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '@/lib/constants'

// ─── Provision Schema ───────────────────────────────────

export const m365ProvisionSchema = z.object({
  employeeId: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().min(1),
  licenses: z.array(z.string()).default([]),
})

// ─── Disable Schema ─────────────────────────────────────

export const m365DisableSchema = z.object({
  employeeId: z.string().uuid(),
  email: z.string().email(),
  revokeAllLicenses: z.boolean().default(true),
  convertToShared: z.boolean().default(false),
})

// ─── Log List Schema ────────────────────────────────────

export const m365LogListSchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(100).default(DEFAULT_PAGE_SIZE),
  actionType: z.enum([
    'PROVISION',
    'DISABLE',
    'LICENSE_REVOKE',
    'SHARED_MAILBOX_CONVERT',
    'REACTIVATE',
  ]).optional(),
  employeeId: z.string().uuid().optional(),
})
