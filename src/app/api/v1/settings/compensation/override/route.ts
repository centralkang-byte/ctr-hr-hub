import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { withPermission, perm } from '@/lib/permissions'
import { apiSuccess, apiError } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { createCompanyOverride, deleteCompanyOverride } from '@/lib/settings/getSettings'
import { MODULE, ACTION } from '@/lib/constants'
import { resolveCompanyId } from '@/lib/api/companyFilter'
import type { SessionUser } from '@/types'

const overrideCreateSchema = z.object({
  companyId: z.string().uuid(),
}).strict()

export const POST = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    const body = await req.json()
    const parsed = overrideCreateSchema.safeParse(body)
    if (!parsed.success) return apiError(badRequest(parsed.error.issues.map(i => i.message).join(', ')))
    const companyId = resolveCompanyId(user, parsed.data.companyId)
    await createCompanyOverride('compensationSetting', companyId)
    return apiSuccess({ message: '법인 오버라이드가 생성되었습니다' }, 201)
  },
  perm(MODULE.SETTINGS, ACTION.CREATE)
)

export const DELETE = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const rawCompanyId = searchParams.get('companyId')
    if (!rawCompanyId) return apiError(badRequest('companyId 파라미터가 필요합니다'))
    const idParsed = z.string().uuid().safeParse(rawCompanyId)
    if (!idParsed.success) return apiError(badRequest('유효하지 않은 companyId 형식입니다'))
    const companyId = resolveCompanyId(user, rawCompanyId)
    await deleteCompanyOverride('compensationSetting', companyId)
    return apiSuccess({ message: '글로벌 기본값으로 복귀했습니다' })
  },
  perm(MODULE.SETTINGS, ACTION.DELETE)
)
