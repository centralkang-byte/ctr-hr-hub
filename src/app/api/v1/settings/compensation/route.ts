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

const compensationUpdateSchema = z.object({
  companyId: z.string().uuid().optional(),
  payComponents: z.any().optional(),
  salaryBands: z.any().optional(),
  raiseMatrix: z.any().optional(),
  bonusType: z.string().optional(),
  bonusRules: z.any().optional(),
  currency: z.string().min(1).max(10).optional(),
}).strict()

// companyId 자동감지: query param 우선, 없으면 세션에서 추출
export const GET = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const companyId = searchParams.get('companyId') ?? user.companyId
    if (!companyId) return apiError(badRequest('companyId를 확인할 수 없습니다'))

    const result = await getCompanySettings('compensationSetting', companyId)
    return apiSuccess(result)
  },
  perm(MODULE.SETTINGS, ACTION.VIEW)
)

export const PUT = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    const body = await req.json()
    const parsed = compensationUpdateSchema.safeParse(body)
    if (!parsed.success) return apiError(badRequest(parsed.error.issues.map(i => i.message).join(', ')))
    const { companyId: bodyCompanyId, ...data } = parsed.data
    const companyId = bodyCompanyId ?? user.companyId
    if (!companyId) return apiError(badRequest('companyId를 확인할 수 없습니다'))

    const existing = await prisma.compensationSetting.findFirst({ where: { companyId } })
    if (!existing) return apiError(notFound('해당 법인의 보상 설정이 없습니다.'))

    const updated = await prisma.compensationSetting.update({
      where: { id: existing.id },
      data: {
        payComponents: data.payComponents,
        salaryBands: data.salaryBands,
        raiseMatrix: data.raiseMatrix,
        bonusType: data.bonusType,
        bonusRules: data.bonusRules,
        currency: data.currency,
      },
    })

    logAudit({
      actorId: user.id,
      action: 'SETTINGS_UPDATE',
      resourceType: 'CompensationSetting',
      resourceId: existing.id,
      companyId: companyId,
      changes: { updatedFields: Object.keys(data).filter(k => data[k as keyof typeof data] !== undefined) },
      ...extractRequestMeta(req.headers),
    })

    return apiSuccess(updated)
  },
  perm(MODULE.SETTINGS, ACTION.UPDATE)
)
