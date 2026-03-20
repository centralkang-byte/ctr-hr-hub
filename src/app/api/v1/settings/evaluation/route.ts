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

const evaluationUpdateSchema = z.object({
  companyId: z.string().uuid().optional(),
  methodology: z.string().optional(),
  mboGrades: z.any().optional(),
  beiGrades: z.any().optional(),
  overallGradeEnabled: z.boolean().optional(),
  overallGradeMethod: z.string().optional(),
  mboWeight: z.number().min(0).max(100).optional(),
  beiWeight: z.number().min(0).max(100).optional(),
  forcedDistribution: z.boolean().optional(),
  forcedDistributionType: z.string().optional(),
  distributionRules: z.any().optional(),
  reviewProcessOrder: z.any().optional(),
}).strict()

// GET /api/v1/settings/evaluation?companyId=
// companyId 자동감지: query param 우선, 없으면 세션에서 추출
export const GET = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const companyId = searchParams.get('companyId') ?? user.companyId
    if (!companyId) return apiError(badRequest('companyId를 확인할 수 없습니다'))

    const result = await getCompanySettings('evaluationSetting', companyId)
    return apiSuccess(result)
  },
  perm(MODULE.SETTINGS, ACTION.VIEW)
)

// PUT /api/v1/settings/evaluation
export const PUT = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    const body = await req.json()
    const parsed = evaluationUpdateSchema.safeParse(body)
    if (!parsed.success) return apiError(badRequest(parsed.error.issues.map(i => i.message).join(', ')))
    const { companyId: bodyCompanyId, ...data } = parsed.data
    const companyId = bodyCompanyId ?? user.companyId
    if (!companyId) return apiError(badRequest('companyId를 확인할 수 없습니다'))

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

    logAudit({
      actorId: user.id,
      action: 'SETTINGS_UPDATE',
      resourceType: 'EvaluationSetting',
      resourceId: existing.id,
      companyId: companyId,
      changes: { updatedFields: Object.keys(data).filter(k => data[k as keyof typeof data] !== undefined) },
      ...extractRequestMeta(req.headers),
    })

    return apiSuccess(updated)
  },
  perm(MODULE.SETTINGS, ACTION.UPDATE)
)
