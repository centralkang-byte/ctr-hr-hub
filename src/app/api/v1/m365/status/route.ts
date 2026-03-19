// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/m365/status
// M365 계정 상태 조회
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { apiSuccess } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { getM365AccountStatus, M365_LICENSES } from '@/lib/integrations/m365-account'
import type { SessionUser } from '@/types'
import { z } from 'zod'

const emailQuerySchema = z.object({
  email: z.string().email(),
})

// ─── GET /api/v1/m365/status?email=xxx ──────────────────

export const GET = withPermission(
  async (req: NextRequest, _context, _user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = emailQuerySchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('유효한 이메일 주소가 필요합니다.', { issues: parsed.error.issues })
    }

    const { email } = parsed.data

    const status = await getM365AccountStatus(email)

    return apiSuccess({
      ...status,
      availableLicenses: M365_LICENSES,
    })
  },
  perm(MODULE.SETTINGS, ACTION.VIEW),
)
