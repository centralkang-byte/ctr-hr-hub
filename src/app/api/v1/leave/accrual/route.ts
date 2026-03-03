// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Leave Accrual Processing API (B6-2)
// POST /api/v1/leave/accrual  — 일괄 부여 실행
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { apiSuccess } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { processAnnualAccrual } from '@/lib/leave/accrualEngine'
import { z } from 'zod'
import type { SessionUser } from '@/types'

const accrualSchema = z.object({
  companyId: z.string().uuid(),
  year: z.number().int().min(2020).max(2099),
})

export const POST = withPermission(
  async (req: NextRequest, _context, _user: SessionUser) => {
    const body = await req.json()
    const parsed = accrualSchema.safeParse(body)
    if (!parsed.success) throw badRequest(parsed.error.message)

    const { companyId, year } = parsed.data
    const result = await processAnnualAccrual(companyId, year)

    return apiSuccess({
      companyId,
      year,
      ...result,
      message: `${result.processed}건 부여 완료, ${result.errors}건 오류`,
    })
  },
  perm(MODULE.SETTINGS, ACTION.APPROVE),
)
