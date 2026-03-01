// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 57-T Annual Salary Survey Report
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { apiSuccess } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { ruReportQuerySchema } from '@/lib/schemas/compliance'
import { generate57TReport } from '@/lib/compliance/ru'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/compliance/ru/reports/57t ──────────────
// 57-T annual salary survey by job category (Росстат форма 57-Т)

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = ruReportQuerySchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { year } = parsed.data
    const report = await generate57TReport(user.companyId, year)

    const { ip, userAgent } = extractRequestMeta(req.headers)
    logAudit({
      actorId: user.employeeId,
      action: 'compliance.ru.report.57t',
      resourceType: 'report',
      resourceId: user.companyId,
      companyId: user.companyId,
      changes: { year },
      ip,
      userAgent,
    })

    return apiSuccess(report)
  },
  perm(MODULE.COMPLIANCE, ACTION.VIEW),
)
