// ═══════════════════════════════════════════════════════════
// CTR HR Hub — AI Eval Comment Suggestion
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { apiSuccess } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { suggestEvalComment } from '@/lib/claude'
import { MODULE, ACTION } from '@/lib/constants'
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import type { SessionUser } from '@/types'

// ─── Schema ──────────────────────────────────────────────

const requestSchema = z.object({
  employeeName: z.string().min(1),
  goalSummary: z.string().min(1),
  goalScores: z.array(z.object({
    title: z.string(),
    score: z.number(),
    weight: z.number(),
  })),
  competencyScores: z.array(z.object({
    name: z.string(),
    score: z.number(),
  })),
  evalType: z.enum(['SELF', 'MANAGER']),
})

// ─── POST /api/v1/ai/eval-comment ────────────────────────

export const POST = withRateLimit(withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = requestSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const result = await suggestEvalComment(
      parsed.data,
      user.companyId,
      user.employeeId,
    )

    return apiSuccess(result)
  },
  perm(MODULE.PERFORMANCE, ACTION.APPROVE),
), RATE_LIMITS.AI)
