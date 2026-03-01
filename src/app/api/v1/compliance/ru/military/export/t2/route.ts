// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Military Registration T-2 Form Export
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { generateT2Report } from '@/lib/compliance/ru'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/compliance/ru/military/export/t2 ───────
// Export T-2 military registration form data (JSON; Excel generation client-side)

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const data = await generateT2Report(user.companyId)

    const { ip, userAgent } = extractRequestMeta(req.headers)
    logAudit({
      actorId: user.employeeId,
      action: 'compliance.ru.military.export.t2',
      resourceType: 'militaryRegistration',
      resourceId: user.companyId,
      companyId: user.companyId,
      changes: { exportedCount: data.length },
      ip,
      userAgent,
    })

    return apiSuccess({
      reportType: 'T-2',
      exportedAt: new Date().toISOString(),
      companyId: user.companyId,
      totalRecords: data.length,
      records: data,
    })
  },
  perm(MODULE.COMPLIANCE, ACTION.EXPORT),
)
