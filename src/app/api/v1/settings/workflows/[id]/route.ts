// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Workflow Rule Detail API
// GET: 단건 조회 / PUT: 수정 (트랜잭션) / DELETE: 소프트 삭제
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { badRequest, notFound, isAppError, handlePrismaError } from '@/lib/errors'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { workflowRuleUpdateSchema } from '@/lib/schemas/settings'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (_req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params

    const rule = await prisma.workflowRule.findFirst({
      where: { id, companyId: user.companyId, deletedAt: null },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    })
    if (!rule) throw notFound('워크플로를 찾을 수 없습니다.')

    return apiSuccess(rule)
  },
  perm(MODULE.SETTINGS, ACTION.VIEW),
)

export const PUT = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const body: unknown = await req.json()
    const parsed = workflowRuleUpdateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    try {
      const existing = await prisma.workflowRule.findFirst({
        where: { id, companyId: user.companyId, deletedAt: null },
      })
      if (!existing) throw notFound('워크플로를 찾을 수 없습니다.')

      const data = parsed.data

      const result = await prisma.$transaction(async (tx) => {
        await tx.workflowRule.update({
          where: { id },
          data: {
            ...(data.name !== undefined && { name: data.name }),
            ...(data.isActive !== undefined && { isActive: data.isActive }),
            ...(data.conditions !== undefined && { conditions: data.conditions }),
            ...(data.steps && { totalSteps: data.steps.length }),
          },
        })

        if (data.steps) {
          await tx.workflowStep.deleteMany({ where: { ruleId: id } })
          await tx.workflowStep.createMany({
            data: data.steps.map((step) => ({
              ruleId: id,
              stepOrder: step.stepOrder,
              approverType: step.approverType,
              approverRoleId: step.approverRoleId ?? null,
              approverEmployeeId: step.approverEmployeeId ?? null,
              autoApproveAfterHours: step.autoApproveAfterHours ?? null,
              canSkip: step.canSkip,
            })),
          })
        }

        return tx.workflowRule.findUnique({
          where: { id },
          include: { steps: { orderBy: { stepOrder: 'asc' } } },
        })
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'settings.workflow_rule.update',
        resourceType: 'workflowRule',
        resourceId: id,
        companyId: user.companyId,
        ip,
        userAgent,
      })

      return apiSuccess(result)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.SETTINGS, ACTION.UPDATE),
)

export const DELETE = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params

    try {
      const existing = await prisma.workflowRule.findFirst({
        where: { id, companyId: user.companyId, deletedAt: null },
      })
      if (!existing) throw notFound('워크플로를 찾을 수 없습니다.')

      await prisma.workflowRule.update({
        where: { id },
        data: { deletedAt: new Date() },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'settings.workflow_rule.delete',
        resourceType: 'workflowRule',
        resourceId: id,
        companyId: user.companyId,
        ip,
        userAgent,
      })

      return apiSuccess({ id })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.SETTINGS, ACTION.DELETE),
)
