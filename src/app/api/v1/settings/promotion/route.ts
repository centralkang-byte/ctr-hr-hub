import { type NextRequest } from 'next/server'
import { withPermission, perm } from '@/lib/permissions'
import { apiSuccess, apiError } from '@/lib/api'
import { badRequest, notFound } from '@/lib/errors'
import { getCompanySettings } from '@/lib/settings/getSettings'
import { prisma } from '@/lib/prisma'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest) => {
    const { searchParams } = new URL(req.url)
    const companyId = searchParams.get('companyId')
    if (!companyId) return apiError(badRequest('companyId 파라미터가 필요합니다'))

    const result = await getCompanySettings('promotionSetting', companyId)
    return apiSuccess(result)
  },
  perm(MODULE.SETTINGS, ACTION.VIEW)
)

export const PUT = withPermission(
  async (req: NextRequest, _ctx, _user: SessionUser) => {
    const body = await req.json()
    const { companyId, ...data } = body
    if (!companyId) return apiError(badRequest('companyId가 필요합니다'))

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
    return apiSuccess(updated)
  },
  perm(MODULE.SETTINGS, ACTION.UPDATE)
)
