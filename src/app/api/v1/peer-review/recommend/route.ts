// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Peer Review Recommendation
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { apiSuccess } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { recommendPeers } from '@/lib/peer-recommend'
import type { SessionUser } from '@/types'

const querySchema = z.object({
  employeeId: z.string(),
  cycleId: z.string(),
  limit: z.coerce.number().int().positive().max(10).default(5),
})

// ─── GET /api/v1/peer-review/recommend ───────────────────

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = querySchema.safeParse(params)
    if (!parsed.success) throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })

    const { employeeId, cycleId, limit } = parsed.data
    const candidates = await recommendPeers(employeeId, user.companyId, cycleId, limit)

    return apiSuccess(candidates)
  },
  perm(MODULE.PERFORMANCE, ACTION.VIEW),
)
