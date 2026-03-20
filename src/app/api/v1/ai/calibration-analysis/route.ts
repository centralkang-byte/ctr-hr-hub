// ═══════════════════════════════════════════════════════════
// CTR HR Hub — AI Calibration Analysis
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { apiSuccess } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { calibrationAnalysis } from '@/lib/claude'
import { MODULE, ACTION } from '@/lib/constants'
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import type { SessionUser } from '@/types'

// ─── Schema ──────────────────────────────────────────────

const requestSchema = z.object({
  sessionName: z.string().min(1),
  departmentName: z.string().optional(),
  evaluations: z.array(z.object({
    employeeName: z.string(),
    performanceScore: z.number(),
    competencyScore: z.number(),
    emsBlock: z.string(),
    selfScore: z.number().optional(),
    managerScore: z.number().optional(),
  })),
  blockDistribution: z.record(z.string(), z.number()),
})

// ─── POST /api/v1/ai/calibration-analysis ────────────────

export const POST = withRateLimit(withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = requestSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const result = await calibrationAnalysis(
      parsed.data,
      user.companyId,
      user.employeeId,
    )

    return apiSuccess(result)
  },
  perm(MODULE.PERFORMANCE, ACTION.APPROVE),
), RATE_LIMITS.AI)
