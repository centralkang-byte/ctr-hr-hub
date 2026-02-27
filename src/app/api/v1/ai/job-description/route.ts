// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/ai/job-description
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { apiSuccess } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { generateJobDescription } from '@/lib/claude'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── Validation Schema ───────────────────────────────────

const bodySchema = z.object({
  title: z.string().min(1, '직무명을 입력해주세요.'),
  department: z.string().optional(),
  grade: z.string().optional(),
  category: z.string().optional(),
  requirements: z.string().optional(),
})

// ─── POST /api/v1/ai/job-description ──────────────────────

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const result = await generateJobDescription(
      parsed.data,
      user.companyId,
      user.employeeId,
    )

    return apiSuccess(result)
  },
  perm(MODULE.RECRUITMENT, ACTION.CREATE),
)
