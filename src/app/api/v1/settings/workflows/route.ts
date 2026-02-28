// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Workflow Rule API
// GET: 워크플로 목록 / POST: 워크플로 생성 (트랜잭션)
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiPaginated, buildPagination, apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { workflowRuleSearchSchema, workflowRuleCreateSchema } from '@/lib/schemas/settings'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = workflowRuleSearchSchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { page, limit, workflowType } = parsed.data
    const where = {
      companyId: user.companyId,
      deletedAt: null,
      ...(workflowType ? { workflowType } : {}),
    }

    const [items, total] = await Promise.all([
      prisma.workflowRule.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          steps: { orderBy: { stepOrder: 'asc' } },
        },
      }),
      prisma.workflowRule.count({ where }),
    ])

    return apiPaginated(items, buildPagination(page, limit, total))
  },
  perm(MODULE.SETTINGS, ACTION.VIEW),
)

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = workflowRuleCreateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { workflowType, name, steps, conditions } = parsed.data

    try {
      const result = await prisma.$transaction(async (tx) => {
        const rule = await tx.workflowRule.create({
          data: {
            companyId: user.companyId,
            workflowType,
            name,
            totalSteps: steps.length,
            conditions: conditions ?? undefined,
          },
        })

        await tx.workflowStep.createMany({
          data: steps.map((step) => ({
            ruleId: rule.id,
            stepOrder: step.stepOrder,
            approverType: step.approverType,
            approverRoleId: step.approverRoleId ?? null,
            approverEmployeeId: step.approverEmployeeId ?? null,
            autoApproveAfterHours: step.autoApproveAfterHours ?? null,
            canSkip: step.canSkip,
          })),
        })

        return tx.workflowRule.findUnique({
          where: { id: rule.id },
          include: { steps: { orderBy: { stepOrder: 'asc' } } },
        })
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'settings.workflow_rule.create',
        resourceType: 'workflowRule',
        resourceId: result!.id,
        companyId: user.companyId,
        changes: { workflowType, name, stepsCount: steps.length },
        ip,
        userAgent,
      })

      return apiSuccess(result, 201)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.SETTINGS, ACTION.CREATE),
)
