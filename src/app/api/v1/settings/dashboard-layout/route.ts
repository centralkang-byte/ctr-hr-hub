// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Dashboard Layout API
// GET: 대시보드 레이아웃 조회 / PUT: 대시보드 레이아웃 수정
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { badRequest } from '@/lib/errors'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { getTenantSettings, invalidateTenantSettingsCache } from '@/lib/tenant-settings'
import { dashboardLayoutUpdateSchema } from '@/lib/schemas/settings'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (_req: NextRequest, _context, user: SessionUser) => {
    const settings = await getTenantSettings(user.companyId)

    return apiSuccess({
      dashboardLayout: settings.dashboardLayout,
    })
  },
  perm(MODULE.SETTINGS, ACTION.VIEW),
)

export const PUT = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = dashboardLayoutUpdateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { dashboardLayout } = parsed.data
    const result = await prisma.tenantSetting.update({
      where: { companyId: user.companyId },
      data: { dashboardLayout },
    })

    await invalidateTenantSettingsCache(user.companyId)

    const { ip, userAgent } = extractRequestMeta(req.headers)
    logAudit({
      actorId: user.employeeId,
      action: 'settings.dashboard_layout.update',
      resourceType: 'tenantSetting',
      resourceId: result.id,
      companyId: user.companyId,
      changes: { dashboardLayout },
      ip,
      userAgent,
    })

    return apiSuccess({ dashboardLayout: result.dashboardLayout })
  },
  perm(MODULE.SETTINGS, ACTION.UPDATE),
)
