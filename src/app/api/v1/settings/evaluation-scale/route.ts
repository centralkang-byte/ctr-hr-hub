// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Evaluation Scale Settings API
// GET: 평가 척도 조회 / PUT: 평가 척도 수정
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { badRequest } from '@/lib/errors'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { getTenantSettings, invalidateTenantSettingsCache } from '@/lib/tenant-settings'
import { evaluationScaleUpdateSchema } from '@/lib/schemas/settings'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (_req: NextRequest, _context, user: SessionUser) => {
    const settings = await getTenantSettings(user.companyId)

    return apiSuccess({
      ratingScaleMin: settings.ratingScaleMin,
      ratingScaleMax: settings.ratingScaleMax,
      ratingLabels: settings.ratingLabels,
      gradeLabels: settings.gradeLabels,
    })
  },
  perm(MODULE.SETTINGS, ACTION.VIEW),
)

export const PUT = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = evaluationScaleUpdateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const data = parsed.data
    const result = await prisma.tenantSetting.update({
      where: { companyId: user.companyId },
      data: {
        ratingScaleMin: data.ratingScaleMin,
        ratingScaleMax: data.ratingScaleMax,
        ratingLabels: data.ratingLabels,
        gradeLabels: data.gradeLabels,
      },
    })

    await invalidateTenantSettingsCache(user.companyId)

    const { ip, userAgent } = extractRequestMeta(req.headers)
    logAudit({
      actorId: user.employeeId,
      action: 'settings.evaluation_scale.update',
      resourceType: 'tenantSetting',
      resourceId: result.id,
      companyId: user.companyId,
      changes: data,
      ip,
      userAgent,
    })

    return apiSuccess({
      ratingScaleMin: result.ratingScaleMin,
      ratingScaleMax: result.ratingScaleMax,
      ratingLabels: result.ratingLabels,
      gradeLabels: result.gradeLabels,
    })
  },
  perm(MODULE.SETTINGS, ACTION.UPDATE),
)
