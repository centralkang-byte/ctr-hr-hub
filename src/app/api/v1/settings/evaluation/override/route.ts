import { type NextRequest } from 'next/server'
import { withPermission, perm } from '@/lib/permissions'
import { apiSuccess, apiError } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { createCompanyOverride, deleteCompanyOverride } from '@/lib/settings/getSettings'
import { MODULE, ACTION } from '@/lib/constants'

// POST /api/v1/settings/evaluation/override — 글로벌 값 복사하여 법인 오버라이드 생성
export const POST = withPermission(
  async (req: NextRequest) => {
    const { companyId } = await req.json()
    if (!companyId) return apiError(badRequest('companyId가 필요합니다'))

    await createCompanyOverride('evaluationSetting', companyId)
    return apiSuccess({ message: '법인 오버라이드가 생성되었습니다' }, 201)
  },
  perm(MODULE.SETTINGS, ACTION.CREATE)
)

// DELETE /api/v1/settings/evaluation/override?companyId= — 오버라이드 삭제 (글로벌로 복귀)
export const DELETE = withPermission(
  async (req: NextRequest) => {
    const { searchParams } = new URL(req.url)
    const companyId = searchParams.get('companyId')
    if (!companyId) return apiError(badRequest('companyId 파라미터가 필요합니다'))

    await deleteCompanyOverride('evaluationSetting', companyId)
    return apiSuccess({ message: '글로벌 기본값으로 복귀했습니다' })
  },
  perm(MODULE.SETTINGS, ACTION.DELETE)
)
