// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Bias Detection (규칙 기반, LLM 불사용)
// POST: 분석 실행 + 저장 | GET: 로그 조회
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

// GET: 편향 로그 목록 조회
export const GET = withPermission(
  async (req: NextRequest, _context: unknown, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const acknowledged = params.acknowledged === 'false' ? false : undefined

    const logs = await prisma.biasDetectionLog.findMany({
      where: {
        companyId: user.companyId,
        ...(acknowledged !== undefined ? { isAcknowledged: acknowledged } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return apiSuccess(logs)
  },
  perm(MODULE.PERFORMANCE, ACTION.VIEW),
)

const checkSchema = z.object({
  cycleId: z.string(),
  reviewerIds: z.array(z.string()).optional(),
})

// POST: 편향 감지 실행
export const POST = withPermission(
  async (req: NextRequest, _context: unknown, user: SessionUser) => {
    const body = await req.json()
    const parsed = checkSchema.safeParse(body)
    if (!parsed.success) throw badRequest('잘못된 요청입니다.', { issues: parsed.error.issues })

    const { cycleId, reviewerIds } = parsed.data

    // 해당 사이클의 MANAGER 평가 목록 조회
    const evaluations = await prisma.performanceEvaluation.findMany({
      where: {
        cycleId,
        companyId: user.companyId,
        evalType: 'MANAGER',
        ...(reviewerIds ? { evaluatorId: { in: reviewerIds } } : {}),
      },
      select: {
        evaluatorId: true,
        performanceGrade: true,
        employeeId: true,
      },
    })

    // 평가자별 그룹화
    const byReviewer: Record<string, typeof evaluations> = {}
    for (const ev of evaluations) {
      if (!byReviewer[ev.evaluatorId]) byReviewer[ev.evaluatorId] = []
      byReviewer[ev.evaluatorId].push(ev)
    }

    // 사이클 이름 조회
    const cycle = await prisma.performanceCycle.findUnique({
      where: { id: cycleId },
      select: { name: true },
    })
    const cycleName = cycle?.name ?? cycleId

    const detectedLogs: {
      reviewerId: string; biasType: string; severity: string
      description: string; details: object
    }[] = []

    const THRESHOLDS = {
      centralTendency: { warning: 0.6, critical: 0.8 },
      leniency: { warning: 0.7, critical: 0.85 },
      severity: { warning: 0.7, critical: 0.85 },
    }

    for (const [reviewerId, evals] of Object.entries(byReviewer)) {
      if (evals.length < 3) continue

      const grades = evals.map((e) => e.performanceGrade).filter(Boolean) as string[]
      if (grades.length === 0) continue

      const gradeCounts: Record<string, number> = {}
      for (const g of grades) gradeCounts[g] = (gradeCounts[g] ?? 0) + 1

      const total = grades.length
      const maxGradeRatio = Math.max(...Object.values(gradeCounts)) / total

      // 1. Central Tendency
      if (maxGradeRatio >= THRESHOLDS.centralTendency.warning) {
        const topGrade = Object.entries(gradeCounts).sort((a, b) => b[1] - a[1])[0]
        const severity = maxGradeRatio >= THRESHOLDS.centralTendency.critical ? 'critical' : 'warning'
        detectedLogs.push({
          reviewerId,
          biasType: 'central_tendency',
          severity,
          description: `이 평가자의 등급 분포가 '${topGrade[0]}' 등급에 ${Math.round(maxGradeRatio * 100)}% 집중되어 있습니다.`,
          details: { gradeCounts, total, topGrade: topGrade[0], ratio: maxGradeRatio },
        })
      }

      // 2. Leniency
      const sortedGrades = Object.keys(gradeCounts).sort().reverse()
      const top2Grades = sortedGrades.slice(0, 2)
      const top2Count = top2Grades.reduce((sum, g) => sum + (gradeCounts[g] ?? 0), 0)
      const top2Ratio = top2Count / total
      if (top2Ratio >= THRESHOLDS.leniency.warning && total >= 5) {
        const severity = top2Ratio >= THRESHOLDS.leniency.critical ? 'critical' : 'warning'
        detectedLogs.push({
          reviewerId,
          biasType: 'leniency',
          severity,
          description: `상위 등급(${top2Grades.join(', ')})에 ${Math.round(top2Ratio * 100)}% 집중 — 관대화 경향이 의심됩니다.`,
          details: { gradeCounts, top2Grades, top2Ratio, total },
        })
      }
    }

    // 저장
    if (detectedLogs.length > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.biasDetectionLog.deleteMany({
          where: {
            companyId: user.companyId,
            evaluationCycle: cycleName,
          },
        })
        await tx.biasDetectionLog.createMany({
          data: detectedLogs.map((log) => ({
            ...log,
            companyId: user.companyId,
            evaluationCycle: cycleName,
            details: log.details as object,
          })),
        })
      })
    }

    return apiSuccess({
      analyzed: Object.keys(byReviewer).length,
      detected: detectedLogs.length,
      logs: detectedLogs,
    })
  },
  perm(MODULE.PERFORMANCE, ACTION.APPROVE),
)
