import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { withPermission, perm } from '@/lib/permissions'
import { apiSuccess, apiError } from '@/lib/api'
import { badRequest, notFound } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { MODULE, ACTION } from '@/lib/constants'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import type { SessionUser } from '@/types'

const flowInclude = { steps: { orderBy: { stepOrder: 'asc' as const } } }

const stepSchema = z.object({
  approverType: z.string().min(1).optional(),
  approverRole: z.string().nullable().optional(),
  approverUserId: z.string().uuid().nullable().optional(),
  isRequired: z.boolean().optional(),
  autoApproveDays: z.number().int().min(1).max(30).nullable().optional(),
}).strict()

const createFlowSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  companyId: z.string().uuid().nullable().optional(),
  module: z.string().min(1),
  steps: z.array(stepSchema).optional(),
}).strict()

const updateFlowSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional(),
  module: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  steps: z.array(stepSchema).optional(),
}).strict()

// GET /api/v1/settings/approval-flows?module=&companyId=
// 글로벌(companyId=null) + 법인 오버라이드 모두 반환
export const GET = withPermission(
  async (req: NextRequest) => {
    const { searchParams } = new URL(req.url)
    const approvalModule = searchParams.get('module')
    const companyId = searchParams.get('companyId')

    const where: Record<string, unknown> = {}
    if (approvalModule) where.module = approvalModule
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
  async (req: NextRequest, _ctx, user: SessionUser) => {
    const body = await req.json()
    const parsed = createFlowSchema.safeParse(body)
    if (!parsed.success) return apiError(badRequest(parsed.error.issues.map(i => i.message).join(', ')))
    const { name, description, companyId, module, steps } = parsed.data

    const flow = await prisma.approvalFlow.create({
      data: {
        name,
        description,
        companyId: companyId ?? null,
        module,
        steps: {
          create: (steps ?? []).map((s, i: number) => ({
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

    logAudit({
      actorId: user.id,
      action: 'SETTINGS_CREATE',
      resourceType: 'ApprovalFlow',
      resourceId: flow.id,
      companyId: companyId ?? user.companyId,
      changes: { name, module, stepsCount: steps?.length ?? 0 },
      ...extractRequestMeta(req.headers),
    })

    return apiSuccess(flow, 201)
  },
  perm(MODULE.SETTINGS, ACTION.CREATE)
)

// PUT /api/v1/settings/approval-flows — 플로우 업데이트
export const PUT = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    const body = await req.json()
    const parsed = updateFlowSchema.safeParse(body)
    if (!parsed.success) return apiError(badRequest(parsed.error.issues.map(i => i.message).join(', ')))
    const { id, name, description, module, isActive, steps } = parsed.data

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
        steps: {
          create: (steps ?? []).map((s, i: number) => ({
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

    logAudit({
      actorId: user.id,
      action: 'SETTINGS_UPDATE',
      resourceType: 'ApprovalFlow',
      resourceId: id,
      companyId: existing.companyId ?? user.companyId,
      changes: { name, module, isActive, stepsCount: steps?.length },
      ...extractRequestMeta(req.headers),
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
    const idParsed = z.string().uuid().safeParse(id)
    if (!idParsed.success) return apiError(badRequest('유효하지 않은 ID 형식입니다'))

    await prisma.approvalFlow.delete({ where: { id } })
    return apiSuccess({ message: '승인 플로우가 삭제되었습니다' })
  },
  perm(MODULE.SETTINGS, ACTION.DELETE)
)
