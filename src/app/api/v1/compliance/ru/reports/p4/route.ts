// ═══════════════════════════════════════════════════════════
// CTR HR Hub — P-4 Quarterly Report
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { apiSuccess } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { ruReportQuerySchema } from '@/lib/schemas/compliance'
import { generateP4Report } from '@/lib/compliance/ru'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/compliance/ru/reports/p4 ───────────────
// P-4 quarterly employee/salary statistics (Росстат форма П-4)

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = ruReportQuerySchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { year, quarter } = parsed.data
    if (!quarter) {
      throw badRequest('P-4 보고서 생성을 위해 분기(quarter) 파라미터가 필요합니다.')
    }

    const report = await generateP4Report(user.companyId, year, quarter)

    const { ip, userAgent } = extractRequestMeta(req.headers)
    logAudit({
      actorId: user.employeeId,
      action: 'compliance.ru.report.p4',
      resourceType: 'report',
      resourceId: user.companyId,
      companyId: user.companyId,
      changes: { year, quarter },
      ip,
      userAgent,
    })

    return apiSuccess(report)
  },
  perm(MODULE.COMPLIANCE, ACTION.VIEW),
)
