// ═══════════════════════════════════════════════════════════
// CTR HR Hub — AI Evaluation Draft Generation
// GET  /api/v1/performance/evaluations/[id]/ai-draft
// POST /api/v1/performance/evaluations/[id]/ai-draft
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { forbidden, notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { generateEvaluationDraft } from '@/lib/claude'
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

export const POST = withPermission(
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

    // 2. Authorization: only evaluator or HR_ADMIN/SUPER_ADMIN
    const isEvaluator = evaluation.evaluatorId === user.employeeId
    const isHrAdmin = user.role === 'HR_ADMIN' || user.role === 'SUPER_ADMIN'
    if (!isEvaluator && !isHrAdmin) {
      throw forbidden('평가 초안 생성 권한이 없습니다.')
    }

    const emp = evaluation.employee
    const assignment = emp.assignments?.[0]
    const departmentName = (assignment as { department?: { name: string } | null } | undefined)?.department?.name ?? null
    const jobGradeName = (assignment as { jobGrade?: { name: string } | null } | undefined)?.jobGrade?.name ?? null

    // Calculate tenure months
    let tenureMonths: number | undefined
    if (emp.hireDate) {
      const now = new Date()
      const hire = new Date(emp.hireDate)
      tenureMonths = Math.floor((now.getTime() - hire.getTime()) / (1000 * 60 * 60 * 24 * 30))
    }

    // 3. Collect MBO goals for this employee and cycle
    const mboGoals = await prisma.mboGoal.findMany({
      where: {
        employeeId: evaluation.employeeId,
        cycleId: evaluation.cycleId,
        companyId: user.companyId,
      },
      select: { title: true, achievementScore: true },
    })

    // 4. Collect recent 1:1s (last 6 months)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const oneOnOnes = await prisma.oneOnOne.findMany({
      where: {
        employeeId: evaluation.employeeId,
        companyId: user.companyId,
        scheduledAt: { gte: sixMonthsAgo },
        status: 'COMPLETED',
      },
      orderBy: { scheduledAt: 'desc' },
      take: 10,
      select: { scheduledAt: true, aiSummary: true, sentimentTag: true, notes: true },
    })

    // 5. Get previous evaluation (same employee, different cycle, most recent)
    const prevEval = await prisma.performanceEvaluation.findFirst({
      where: {
        employeeId: evaluation.employeeId,
        companyId: user.companyId,
        evalType: evaluation.evalType,
        id: { not: id },
        status: 'SUBMITTED',
      },
      orderBy: { createdAt: 'desc' },
      select: { performanceGrade: true, comment: true },
    })

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
        evalType: evaluation.evalType as 'SELF' | 'MANAGER',
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
)
