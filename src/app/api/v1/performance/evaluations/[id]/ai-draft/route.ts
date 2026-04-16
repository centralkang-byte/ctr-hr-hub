// ═══════════════════════════════════════════════════════════
// CTR HR Hub — AI Evaluation Draft Generation
// GET  /api/v1/performance/evaluations/[id]/ai-draft
// POST /api/v1/performance/evaluations/[id]/ai-draft
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, forbidden, notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { MODULE, ACTION } from '@/lib/constants'
import { generateEvaluationDraft } from '@/lib/claude'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/performance/evaluations/[id]/ai-draft ───

export const GET = withPermission(
  async (
    _req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id } = await context.params

    const evaluation = await prisma.performanceEvaluation.findFirst({
      where: { id, companyId: user.companyId },
    })
    if (!evaluation) throw notFound('평가를 찾을 수 없습니다.')

    const draft = await prisma.aiEvaluationDraft.findFirst({
      where: { evaluationId: id, companyId: user.companyId },
      orderBy: { createdAt: 'desc' },
    })

    return apiSuccess(draft)
  },
  perm(MODULE.PERFORMANCE, ACTION.VIEW),
)

// ─── POST /api/v1/performance/evaluations/[id]/ai-draft ──

export const POST = withRateLimit(withPermission(
  async (
    _req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id } = await context.params

    // 1. Find evaluation and verify company
    const evaluation = await prisma.performanceEvaluation.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        employee: {
          include: {
            assignments: {
              where: { isPrimary: true, endDate: null },
              take: 1,
              include: { department: true, jobGrade: true },
            },
          },
        },
      },
    })
    if (!evaluation) throw notFound('평가를 찾을 수 없습니다.')

    // 2a. Guard: PEER evaluations are not supported for AI draft generation
    if (evaluation.evalType === 'PEER') {
      throw badRequest('동료 평가에는 AI 초안을 생성할 수 없습니다.')
    }

    // 2. Authorization: only evaluator or HR_ADMIN/SUPER_ADMIN
    const isEvaluator = evaluation.evaluatorId === user.employeeId
    const isHrAdmin = user.role === 'HR_ADMIN' || user.role === 'SUPER_ADMIN'
    if (!isEvaluator && !isHrAdmin) {
      throw forbidden('평가 초안 생성 권한이 없습니다.')
    }

    const emp = evaluation.employee
    const assignment = extractPrimaryAssignment(emp.assignments ?? [])
    const departmentName = assignment?.department?.name ?? null
    const jobGradeName = assignment?.jobGrade?.name ?? null

    // Calculate tenure months
    let tenureMonths: number | undefined
    if (emp.hireDate) {
      const now = new Date()
      const hire = new Date(emp.hireDate)
      tenureMonths = Math.floor((now.getTime() - hire.getTime()) / (1000 * 60 * 60 * 24 * 30))
    }

    // 3-5. Collect MBO goals, 1:1s, and previous evaluation in parallel
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const [mboGoals, oneOnOnes, prevEval] = await Promise.all([
      // 3. MBO goals for this employee and cycle
      prisma.mboGoal.findMany({
        where: {
          employeeId: evaluation.employeeId,
          cycleId: evaluation.cycleId,
          companyId: user.companyId,
        },
        select: { title: true, achievementScore: true },
      }),

      // 4. Recent 1:1s (last 6 months)
      prisma.oneOnOne.findMany({
        where: {
          employeeId: evaluation.employeeId,
          companyId: user.companyId,
          scheduledAt: { gte: sixMonthsAgo },
          status: 'COMPLETED',
        },
        orderBy: { scheduledAt: 'desc' },
        take: 10,
        select: { scheduledAt: true, aiSummary: true, sentimentTag: true, notes: true },
      }),

      // 5. Previous evaluation (same employee, different cycle, most recent)
      prisma.performanceEvaluation.findFirst({
        where: {
          employeeId: evaluation.employeeId,
          companyId: user.companyId,
          evalType: evaluation.evalType,
          cycleId: { not: evaluation.cycleId },
          id: { not: id },
          status: 'SUBMITTED',
        },
        orderBy: { createdAt: 'desc' },
        select: { performanceGrade: true, comment: true },
      }),
    ])

    // 6. Call AI
    const draftResult = await generateEvaluationDraft(
      {
        employee: {
          name: emp.name,
          jobLevel: jobGradeName,
          department: departmentName,
          tenureMonths,
        },
        mboGoals: mboGoals.map((g) => ({
          title: g.title,
          achievementRate: g.achievementScore != null ? Number(g.achievementScore) : null,
        })),
        oneOnOnes: oneOnOnes.map((o) => ({
          date: o.scheduledAt.toISOString().slice(0, 10),
          summary: o.aiSummary ?? o.notes ?? null,
          sentimentTag: o.sentimentTag ?? null,
        })),
        previousEval: prevEval
          ? { grade: prevEval.performanceGrade ?? null, comment: prevEval.comment ?? null }
          : null,
        evalType: evaluation.evalType as 'SELF' | 'MANAGER', // safe: PEER guarded above
      },
      user.companyId,
      user.employeeId,
    )

    // 7. Save draft
    const inputSummary = {
      goalCount: mboGoals.length,
      oneOnOneCount: oneOnOnes.length,
      hasPrevEval: prevEval != null,
      generatedAt: new Date().toISOString(),
    }

    const saved = await prisma.aiEvaluationDraft.create({
      data: {
        evaluationId: id,
        employeeId: evaluation.employeeId,
        reviewerId: user.employeeId,
        companyId: user.companyId,
        draftContent: draftResult as unknown as import('@/generated/prisma/client').Prisma.InputJsonValue,
        inputSummary: inputSummary as unknown as import('@/generated/prisma/client').Prisma.InputJsonValue,
        status: 'draft',
      },
    })

    return apiSuccess(saved)
  },
  perm(MODULE.PERFORMANCE, ACTION.UPDATE),
), RATE_LIMITS.AI)
