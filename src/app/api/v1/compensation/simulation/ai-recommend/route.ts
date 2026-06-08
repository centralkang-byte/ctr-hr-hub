// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Compensation AI Recommendation
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { aiRecommendSchema } from '@/lib/schemas/compensation'
import { compensationRecommendation } from '@/lib/claude'
import type { SessionUser } from '@/types'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'

// ─── POST /api/v1/compensation/simulation/ai-recommend ───

export const POST = withRateLimit(withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = aiRecommendSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { cycleId, employeeId, budgetConstraint, companyAvgRaise } =
      parsed.data

    // ── Fetch employee data ──────────────────────────────────
    // 멀티테넌트 격리: 비-SUPER는 자기 법인 직원만 (타 법인 직원 PII·급여·compa-ratio 차단).
    // 동시 다법인 active primary 시 내부 select가 타 법인 assignment를 고르지 않도록 동일 스코프 적용 (Codex Gate 2 P1).
    const ownCompanyScope = user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }
    const employee = await prisma.employee.findFirst({
      where: {
        id: employeeId,
        ...(user.role === ROLE.SUPER_ADMIN
          ? {}
          : {
              assignments: {
                // effectiveDate lte now — 미래발령(타 법인) 우회 차단 (Codex Gate 2 P0)
                some: {
                  isPrimary: true,
                  endDate: null,
                  companyId: user.companyId,
                  effectiveDate: { lte: new Date() },
                },
              },
            }),
      },
      select: {
        id: true,
        name: true,
        hireDate: true,
        assignments: {
          // 현재 유효 primary만 (미래발령·타 법인 제외) — empAssignment 단일성·법인 일치 보장
          where: { isPrimary: true, endDate: null, effectiveDate: { lte: new Date() }, ...ownCompanyScope },
          orderBy: { effectiveDate: 'desc' },
          take: 1,
          select: {
            companyId: true,
            jobGradeId: true,
            jobCategoryId: true,
            department: { select: { name: true } },
            jobGrade: { select: { name: true } },
          },
        },
      },
    })

    if (!employee) {
      throw notFound('직원을 찾을 수 없습니다.')
    }

    const empAssignment = extractPrimaryAssignment(employee.assignments ?? [])
    const empJobGradeId = empAssignment?.jobGradeId
    const empJobCategoryId = empAssignment?.jobCategoryId

    // ── Latest compensation ──────────────────────────────────
    const latestComp = await prisma.compensationHistory.findFirst({
      where: { employeeId },
      orderBy: { effectiveDate: 'desc' },
      select: { newBaseSalary: true, currency: true },
    })

    const currentSalary = latestComp ? Number(latestComp.newBaseSalary) : 0
    const currency = latestComp?.currency ?? 'KRW'

    // ── Compa-Ratio ──────────────────────────────────────────
    const salaryBand = await prisma.salaryBand.findFirst({
      where: {
        companyId: empAssignment?.companyId ?? user.companyId,
        jobGradeId: empJobGradeId ?? undefined,
        ...(empJobCategoryId ? { jobCategoryId: empJobCategoryId } : {}),
        deletedAt: null,
      },
      orderBy: { effectiveFrom: 'desc' },
      select: { midSalary: true },
    })

    const midSalary = salaryBand ? Number(salaryBand.midSalary) : 0
    const compaRatio = midSalary > 0 ? currentSalary / midSalary : 1.0

    // ── Latest EMS block ─────────────────────────────────────
    const latestEval = await prisma.performanceEvaluation.findFirst({
      where: { employeeId, status: 'SUBMITTED' },
      orderBy: { createdAt: 'desc' },
      select: { emsBlock: true },
    })

    // ── Tenure ───────────────────────────────────────────────
    const now = new Date()
    const tenureMonths =
      (now.getFullYear() - employee.hireDate.getFullYear()) * 12 +
      (now.getMonth() - employee.hireDate.getMonth())

    // ── Call AI ──────────────────────────────────────────────
    const result = await compensationRecommendation(
      {
        employeeName: employee.name,
        department: (empAssignment as any)?.department?.name ?? '-', // eslint-disable-line @typescript-eslint/no-explicit-any
        grade: (empAssignment as any)?.jobGrade?.name ?? '-', // eslint-disable-line @typescript-eslint/no-explicit-any
        emsBlock: latestEval?.emsBlock ?? null,
        compaRatio,
        currentSalary,
        currency,
        tenureMonths,
        budgetConstraint,
        companyAvgRaise,
      },
      user.companyId,
      employeeId,
    )

    // ── Audit log ───────────────────────────────────────────
    const { ip, userAgent } = extractRequestMeta(req.headers)
    logAudit({
      actorId: user.employeeId,
      action: 'compensation.aiRecommend',
      resourceType: 'employee',
      resourceId: employeeId,
      companyId: user.companyId,
      sensitivityLevel: 'HIGH',
      changes: { cycleId, employeeId, budgetConstraint, companyAvgRaise },
      ip,
      userAgent,
    })

    return apiSuccess(result)
  },
  perm(MODULE.COMPENSATION, ACTION.VIEW),
), RATE_LIMITS.AI)
