// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Off-Cycle Compensation (List + Create)
// GET  /api/v1/compensation/off-cycle
// POST /api/v1/compensation/off-cycle
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, conflict, forbidden, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { offCycleCreateSchema, offCycleSearchSchema } from '@/lib/schemas/compensation'
import { calculateCompaRatio } from '@/lib/compensation'
import { getDirectReportIds } from '@/lib/employee/direct-reports'
import type { SessionUser } from '@/types'
// ─── GET /api/v1/compensation/off-cycle ─────────────────────

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const url = new URL(req.url)
    const params = Object.fromEntries(url.searchParams.entries())
    const parsed = offCycleSearchSchema.safeParse(params)

    if (!parsed.success) {
      throw badRequest('잘못된 검색 조건입니다.', { issues: parsed.error.issues })
    }

    const { page, limit, status, employeeId, reasonCategory, initiatorType } = parsed.data

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {
        companyId: user.companyId,
        ...(status ? { status } : {}),
        ...(employeeId ? { employeeId } : {}),
        ...(reasonCategory ? { reasonCategory } : {}),
        ...(initiatorType ? { initiatorType } : {}),
      }

      // MANAGER: 본인이 발의했거나, 본인 직속부하 대상 요청만 조회
      if (user.role === 'MANAGER') {
        const directReportIds = await getDirectReportIds(user.employeeId)
        where.OR = [
          { initiatorId: user.employeeId },
          { employeeId: { in: directReportIds } },
        ]
      }

      const [total, requests] = await Promise.all([
        prisma.offCycleCompRequest.count({ where }),
        prisma.offCycleCompRequest.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            employee: { select: { id: true, name: true } },
            initiator: { select: { id: true, name: true } },
            approvalSteps: {
              select: { stepNumber: true, roleRequired: true, status: true },
              orderBy: { stepNumber: 'asc' },
            },
          },
        }),
      ])

      const data = requests.map((r) => ({
        id: r.id,
        employeeId: r.employeeId,
        employeeName: r.employee.name,
        initiatorId: r.initiatorId,
        initiatorName: r.initiator.name,
        initiatorType: r.initiatorType,
        reasonCategory: r.reasonCategory,
        reason: r.reason,
        currentBaseSalary: Number(r.currentBaseSalary),
        proposedBaseSalary: Number(r.proposedBaseSalary),
        currency: r.currency,
        changePct: Number(r.changePct),
        effectiveDate: r.effectiveDate,
        status: r.status,
        currentStep: r.currentStep,
        totalSteps: r.totalSteps,
        approvalSteps: r.approvalSteps.map((s) => ({
          stepNumber: s.stepNumber,
          roleRequired: s.roleRequired,
          status: s.status,
        })),
        createdAt: r.createdAt,
      }))

      return apiPaginated(data, buildPagination(page, limit, total))
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.COMPENSATION, ACTION.VIEW),
)

// ─── POST /api/v1/compensation/off-cycle ────────────────────

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = offCycleCreateSchema.safeParse(body)

    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { employeeId, reasonCategory, reason, proposedBaseSalary, effectiveDate, triggerEventType, triggerEventId } = parsed.data

    try {
      // initiatorType 결정
      const initiatorType = user.role === 'MANAGER' ? 'MANAGER' : 'HR'

      // MANAGER: 직속부하 여부 확인
      if (user.role === 'MANAGER') {
        const directReportIds = await getDirectReportIds(user.employeeId)
        if (!directReportIds.includes(employeeId)) {
          throw forbidden('직속 부하 직원에 대해서만 비정기 보상 요청을 할 수 있습니다.')
        }
      }

      // 중복 요청 확인 (DRAFT 또는 PENDING_APPROVAL 상태)
      const existing = await prisma.offCycleCompRequest.findFirst({
        where: {
          employeeId,
          companyId: user.companyId,
          status: { in: ['DRAFT', 'PENDING_APPROVAL'] },
        },
      })

      if (existing) {
        throw conflict('해당 직원에 대해 이미 진행 중인 비정기 보상 요청이 있습니다.')
      }

      // 현재 기본급 조회 (최신 CompensationHistory)
      const latestComp = await prisma.compensationHistory.findFirst({
        where: { employeeId, companyId: user.companyId },
        orderBy: { effectiveDate: 'desc' },
        select: { newBaseSalary: true, currency: true },
      })

      const currentBaseSalary = latestComp ? Number(latestComp.newBaseSalary) : 0
      const currency = latestComp?.currency ?? 'KRW'

      if (currentBaseSalary <= 0) {
        throw badRequest('해당 직원의 현재 급여 정보를 찾을 수 없습니다.')
      }

      // changePct 계산
      const changePct = Math.round(((proposedBaseSalary - currentBaseSalary) / currentBaseSalary) * 10000) / 100

      // SalaryBand 조회 → proposedCompaRatio 계산
      const assignment = await prisma.employeeAssignment.findFirst({
        where: { employeeId, isPrimary: true, endDate: null },
        select: { jobGradeId: true },
      })

      let proposedCompaRatio: number | null = null
      if (assignment?.jobGradeId) {
        const band = await prisma.salaryBand.findFirst({
          where: {
            companyId: user.companyId,
            jobGradeId: assignment.jobGradeId,
            deletedAt: null,
          },
          orderBy: { effectiveFrom: 'desc' },
          select: { midSalary: true },
        })

        if (band) {
          proposedCompaRatio = calculateCompaRatio(proposedBaseSalary, Number(band.midSalary))
        }
      }


      // 요청 생성 (DRAFT)
      const request = await prisma.offCycleCompRequest.create({
        data: {
          companyId: user.companyId,
          employeeId,
          initiatorId: user.employeeId,
          initiatorType: initiatorType as 'MANAGER' | 'HR',
          reasonCategory,
          reason: reason ?? null,
          currentBaseSalary,
          proposedBaseSalary,
          currency,
          changePct,
          effectiveDate: new Date(effectiveDate),
          proposedCompaRatio,
          status: 'DRAFT',
          triggerEventType: triggerEventType ?? null,
          triggerEventId: triggerEventId ?? null,
        },
        include: {
          employee: { select: { id: true, name: true } },
          initiator: { select: { id: true, name: true } },
        },
      })

      return apiSuccess({
        id: request.id,
        employeeId: request.employeeId,
        employeeName: request.employee.name,
        initiatorId: request.initiatorId,
        initiatorName: request.initiator.name,
        initiatorType: request.initiatorType,
        reasonCategory: request.reasonCategory,
        reason: request.reason,
        currentBaseSalary: Number(request.currentBaseSalary),
        proposedBaseSalary: Number(request.proposedBaseSalary),
        currency: request.currency,
        changePct: Number(request.changePct),
        proposedCompaRatio: request.proposedCompaRatio ? Number(request.proposedCompaRatio) : null,
        effectiveDate: request.effectiveDate,
        status: request.status,
        createdAt: request.createdAt,
      }, 201)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.COMPENSATION, ACTION.CREATE),
)
