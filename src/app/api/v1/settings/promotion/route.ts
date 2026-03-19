import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { withPermission, perm } from '@/lib/permissions'
import { apiSuccess, apiError } from '@/lib/api'
import { badRequest, notFound } from '@/lib/errors'
import { getCompanySettings } from '@/lib/settings/getSettings'
import { prisma } from '@/lib/prisma'
import { MODULE, ACTION } from '@/lib/constants'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import type { SessionUser } from '@/types'

const promotionUpdateSchema = z.object({
  companyId: z.string().uuid().optional(),
  jobLevels: z.any().optional(),
  promotionRules: z.any().optional(),
  promotionCycle: z.string().optional(),
  promotionMonth: z.number().int().min(1).max(12).optional(),
  approvalChain: z.any().optional(),
}).strict()

// companyId 자동감지: query param 우선, 없으면 세션에서 추출
export const GET = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const companyId = searchParams.get('companyId') ?? user.companyId
    if (!companyId) return apiError(badRequest('companyId를 확인할 수 없습니다'))

    const result = await getCompanySettings('promotionSetting', companyId)
    return apiSuccess(result)
  },
  perm(MODULE.SETTINGS, ACTION.VIEW)
)

export const PUT = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    const body = await req.json()
    const parsed = promotionUpdateSchema.safeParse(body)
    if (!parsed.success) return apiError(badRequest(parsed.error.issues.map(i => i.message).join(', ')))
    const { companyId: bodyCompanyId, ...data } = parsed.data
    const companyId = bodyCompanyId ?? user.companyId
    if (!companyId) return apiError(badRequest('companyId를 확인할 수 없습니다'))

    const existing = await prisma.promotionSetting.findFirst({ where: { companyId } })
    if (!existing) return apiError(notFound('해당 법인의 승진 설정이 없습니다.'))

    const updated = await prisma.promotionSetting.update({
      where: { id: existing.id },
      data: {
        jobLevels: data.jobLevels,
        promotionRules: data.promotionRules,
        promotionCycle: data.promotionCycle,
        promotionMonth: data.promotionMonth,
        approvalChain: data.approvalChain,
      },
    })

    logAudit({
      actorId: user.id,
      action: 'SETTINGS_UPDATE',
      resourceType: 'PromotionSetting',
      resourceId: existing.id,
      companyId: companyId,
      changes: { updatedFields: Object.keys(data).filter(k => data[k as keyof typeof data] !== undefined) },
      ...extractRequestMeta(req.headers),
    })

    return apiSuccess(updated)
  },
  perm(MODULE.SETTINGS, ACTION.UPDATE)
)
