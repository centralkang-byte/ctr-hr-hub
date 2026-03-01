// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Mandatory Training Completion Status
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { apiSuccess } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { mandatoryTrainingStatusSchema } from '@/lib/schemas/compliance'
import { getMandatoryTrainingStatus } from '@/lib/compliance/kr'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = mandatoryTrainingStatusSchema.safeParse(params)
    if (!parsed.success) throw badRequest('Invalid parameters', { issues: parsed.error.issues })

    const status = await getMandatoryTrainingStatus(user.companyId, parsed.data.year)
    return apiSuccess(status)
  },
  perm(MODULE.COMPLIANCE, ACTION.VIEW),
)
