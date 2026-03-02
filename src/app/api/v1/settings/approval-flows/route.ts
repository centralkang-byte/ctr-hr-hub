import { type NextRequest } from 'next/server'
import { withPermission, perm } from '@/lib/permissions'
import { apiSuccess, apiError } from '@/lib/api'
import { badRequest, notFound } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

const flowInclude = { steps: { orderBy: { stepOrder: 'asc' as const } } }

// GET /api/v1/settings/approval-flows?module=&companyId=
// 글로벌(companyId=null) + 법인 오버라이드 모두 반환
export const GET = withPermission(
  async (req: NextRequest) => {
    const { searchParams } = new URL(req.url)
    const module = searchParams.get('module')
    const companyId = searchParams.get('companyId')

    const where: Record<string, unknown> = {}
    if (module) where.module = module
    if (companyId) {
      // 법인 + 글로벌 모두
      where.OR = [{ companyId }, { companyId: null }]
    }

    const flows = await prisma.approvalFlow.findMany({
      where,
      include: flowInclude,
      orderBy: [{ companyId: 'asc' }, { module: 'asc' }],
    })

    return apiSuccess(flows)
  },
  perm(MODULE.SETTINGS, ACTION.VIEW)
)

// POST /api/v1/settings/approval-flows — 새 플로우 생성
export const POST = withPermission(
  async (req: NextRequest, _ctx, _user: SessionUser) => {
    const body = await req.json()
    const { name, description, companyId, module, steps } = body

    if (!name || !module) return apiError(badRequest('name, module이 필요합니다'))

    const flow = await prisma.approvalFlow.create({
      data: {
        name,
        description,
        companyId: companyId ?? null,
        module,
        isActive: true,
        steps: {
          create: (steps ?? []).map((s: Record<string, unknown>, i: number) => ({
            stepOrder: i + 1,
            approverType: s.approverType ?? 'role',
            approverRole: s.approverRole ?? null,
            approverUserId: s.approverUserId ?? null,
            isRequired: s.isRequired ?? true,
            autoApproveDays: s.autoApproveDays ?? null,
          })),
        },
      },
      include: flowInclude,
    })

    return apiSuccess(flow, 201)
  },
  perm(MODULE.SETTINGS, ACTION.CREATE)
)

// PUT /api/v1/settings/approval-flows — 플로우 업데이트
export const PUT = withPermission(
  async (req: NextRequest, _ctx, _user: SessionUser) => {
    const body = await req.json()
    const { id, name, description, module, isActive, steps } = body

    if (!id) return apiError(badRequest('id가 필요합니다'))

    const existing = await prisma.approvalFlow.findUnique({ where: { id } })
    if (!existing) return apiError(notFound('승인 플로우를 찾을 수 없습니다'))

    // steps는 전체 교체 방식
    await prisma.approvalFlowStep.deleteMany({ where: { flowId: id } })

    const updated = await prisma.approvalFlow.update({
      where: { id },
      data: {
        name,
        description,
        module,
        isActive,
        steps: {
          create: (steps ?? []).map((s: Record<string, unknown>, i: number) => ({
            stepOrder: i + 1,
            approverType: s.approverType ?? 'role',
            approverRole: s.approverRole ?? null,
            approverUserId: s.approverUserId ?? null,
            isRequired: s.isRequired ?? true,
            autoApproveDays: s.autoApproveDays ?? null,
          })),
        },
      },
      include: flowInclude,
    })

    return apiSuccess(updated)
  },
  perm(MODULE.SETTINGS, ACTION.UPDATE)
)

// DELETE /api/v1/settings/approval-flows?id=
export const DELETE = withPermission(
  async (req: NextRequest) => {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return apiError(badRequest('id 파라미터가 필요합니다'))

    await prisma.approvalFlow.delete({ where: { id } })
    return apiSuccess({ message: '승인 플로우가 삭제되었습니다' })
  },
  perm(MODULE.SETTINGS, ACTION.DELETE)
)
