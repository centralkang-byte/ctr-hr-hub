// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Module Toggle API
// GET: 활성 모듈 조회 / PUT: 모듈 ON/OFF
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { badRequest } from '@/lib/errors'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { getTenantSettings, invalidateTenantSettingsCache } from '@/lib/tenant-settings'
import { moduleToggleSchema } from '@/lib/schemas/settings'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (_req: NextRequest, _context, user: SessionUser) => {
    const settings = await getTenantSettings(user.companyId)

    return apiSuccess({
      enabledModules: settings.enabledModules,
    })
  },
  perm(MODULE.SETTINGS, ACTION.VIEW),
)

export const PUT = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = moduleToggleSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { enabledModules } = parsed.data
    const result = await prisma.tenantSetting.update({
      where: { companyId: user.companyId },
      data: { enabledModules },
    })

    await invalidateTenantSettingsCache(user.companyId)

    const { ip, userAgent } = extractRequestMeta(req.headers)
    logAudit({
      actorId: user.employeeId,
      action: 'settings.modules.update',
      resourceType: 'tenantSetting',
      resourceId: result.id,
      companyId: user.companyId,
      changes: { enabledModules },
      ip,
      userAgent,
    })

    return apiSuccess({ enabledModules: result.enabledModules })
  },
  perm(MODULE.SETTINGS, ACTION.UPDATE),
)
