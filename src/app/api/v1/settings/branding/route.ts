// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Branding Settings API
// GET: 브랜딩 조회 / PUT: 브랜딩 수정
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { badRequest } from '@/lib/errors'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { getTenantSettings, invalidateTenantSettingsCache } from '@/lib/tenant-settings'
import { brandingUpdateSchema } from '@/lib/schemas/settings'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (_req: NextRequest, _context, user: SessionUser) => {
    const settings = await getTenantSettings(user.companyId)

    return apiSuccess({
      logoUrl: settings.logoUrl,
      faviconUrl: settings.faviconUrl,
      primaryColor: settings.primaryColor,
      secondaryColor: settings.secondaryColor,
      accentColor: settings.accentColor,
    })
  },
  perm(MODULE.SETTINGS, ACTION.VIEW),
)

export const PUT = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = brandingUpdateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const data = parsed.data
    const result = await prisma.tenantSetting.update({
      where: { companyId: user.companyId },
      data: {
        ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl }),
        ...(data.faviconUrl !== undefined && { faviconUrl: data.faviconUrl }),
        ...(data.primaryColor !== undefined && { primaryColor: data.primaryColor }),
        ...(data.secondaryColor !== undefined && { secondaryColor: data.secondaryColor }),
        ...(data.accentColor !== undefined && { accentColor: data.accentColor }),
      },
    })

    await invalidateTenantSettingsCache(user.companyId)

    const { ip, userAgent } = extractRequestMeta(req.headers)
    logAudit({
      actorId: user.employeeId,
      action: 'settings.branding.update',
      resourceType: 'tenantSetting',
      resourceId: result.id,
      companyId: user.companyId,
      changes: data,
      ip,
      userAgent,
    })

    return apiSuccess({
      logoUrl: result.logoUrl,
      faviconUrl: result.faviconUrl,
      primaryColor: result.primaryColor,
      secondaryColor: result.secondaryColor,
      accentColor: result.accentColor,
    })
  },
  perm(MODULE.SETTINGS, ACTION.UPDATE),
)
