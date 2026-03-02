import { type NextRequest } from 'next/server'
import { withPermission, perm } from '@/lib/permissions'
import { apiSuccess, apiError } from '@/lib/api'
import { badRequest, notFound } from '@/lib/errors'
import { getCompanySettings } from '@/lib/settings/getSettings'
import { prisma } from '@/lib/prisma'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

// GET /api/v1/settings/evaluation?companyId=
export const GET = withPermission(
  async (req: NextRequest) => {
    const { searchParams } = new URL(req.url)
    const companyId = searchParams.get('companyId')
    if (!companyId) return apiError(badRequest('companyId 파라미터가 필요합니다'))

    const result = await getCompanySettings('evaluationSetting', companyId)
    return apiSuccess(result)
  },
  perm(MODULE.SETTINGS, ACTION.VIEW)
)

// PUT /api/v1/settings/evaluation
export const PUT = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    const body = await req.json()
    const { companyId, ...data } = body

    if (!companyId) return apiError(badRequest('companyId가 필요합니다'))

    const existing = await prisma.evaluationSetting.findFirst({ where: { companyId } })
    if (!existing) return apiError(notFound('해당 법인의 평가 설정이 없습니다. 먼저 오버라이드를 생성하세요.'))

    const updated = await prisma.evaluationSetting.update({
      where: { id: existing.id },
      data: {
        methodology: data.methodology,
        mboGrades: data.mboGrades,
        beiGrades: data.beiGrades,
        overallGradeEnabled: data.overallGradeEnabled,
        overallGradeMethod: data.overallGradeMethod,
        mboWeight: data.mboWeight,
        beiWeight: data.beiWeight,
        forcedDistribution: data.forcedDistribution,
        forcedDistributionType: data.forcedDistributionType,
        distributionRules: data.distributionRules,
        reviewProcessOrder: data.reviewProcessOrder,
      },
    })

    return apiSuccess(updated)
  },
  perm(MODULE.SETTINGS, ACTION.UPDATE)
)
