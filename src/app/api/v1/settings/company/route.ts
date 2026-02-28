// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Company Settings API
// GET: 회사설정 조회 / PUT: 회사설정 수정
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { badRequest } from '@/lib/errors'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { getTenantSettings, invalidateTenantSettingsCache } from '@/lib/tenant-settings'
import { companySettingsUpdateSchema } from '@/lib/schemas/settings'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (_req: NextRequest, _context, user: SessionUser) => {
    const settings = await getTenantSettings(user.companyId)

    return apiSuccess({
      coreValues: settings.coreValues,
      fiscalYearStartMonth: settings.fiscalYearStartMonth,
      probationMonths: settings.probationMonths,
      maxOvertimeWeeklyHours: Number(settings.maxOvertimeWeeklyHours),
      timezone: settings.timezone,
      defaultLocale: settings.defaultLocale,
    })
  },
  perm(MODULE.SETTINGS, ACTION.VIEW),
)

export const PUT = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = companySettingsUpdateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const data = parsed.data
    const result = await prisma.tenantSetting.update({
      where: { companyId: user.companyId },
      data: {
        ...(data.coreValues !== undefined && { coreValues: data.coreValues }),
        ...(data.fiscalYearStartMonth !== undefined && { fiscalYearStartMonth: data.fiscalYearStartMonth }),
        ...(data.probationMonths !== undefined && { probationMonths: data.probationMonths }),
        ...(data.maxOvertimeWeeklyHours !== undefined && { maxOvertimeWeeklyHours: data.maxOvertimeWeeklyHours }),
        ...(data.timezone !== undefined && { timezone: data.timezone }),
        ...(data.defaultLocale !== undefined && { defaultLocale: data.defaultLocale }),
      },
    })

    await invalidateTenantSettingsCache(user.companyId)

    const { ip, userAgent } = extractRequestMeta(req.headers)
    logAudit({
      actorId: user.employeeId,
      action: 'settings.company.update',
      resourceType: 'tenantSetting',
      resourceId: result.id,
      companyId: user.companyId,
      changes: data,
      ip,
      userAgent,
    })

    return apiSuccess({
      coreValues: result.coreValues,
      fiscalYearStartMonth: result.fiscalYearStartMonth,
      probationMonths: result.probationMonths,
      maxOvertimeWeeklyHours: Number(result.maxOvertimeWeeklyHours),
      timezone: result.timezone,
      defaultLocale: result.defaultLocale,
    })
  },
  perm(MODULE.SETTINGS, ACTION.UPDATE),
)
