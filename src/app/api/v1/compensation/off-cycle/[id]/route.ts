// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Off-Cycle Compensation Detail (GET + PUT)
// GET  /api/v1/compensation/off-cycle/[id]
// PUT  /api/v1/compensation/off-cycle/[id]
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, forbidden, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { offCycleUpdateSchema } from '@/lib/schemas/compensation'
import { calculateCompaRatio } from '@/lib/compensation'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/compensation/off-cycle/[id] ────────────────

export const GET = withPermission(
  async (_req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params

    try {
      const request = await prisma.offCycleCompRequest.findFirst({
        where: { id, companyId: user.companyId },
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              assignments: {
                where: { isPrimary: true, endDate: null },
                select: {
                  departmentId: true,
                  jobGradeId: true,
                  department: { select: { id: true, name: true } },
                  jobGrade: { select: { id: true, name: true } },
                },
                take: 1,
              },
            },
          },
          initiator: { select: { id: true, name: true } },
          approvalSteps: {
            select: {
              id: true,
              stepNumber: true,
              roleRequired: true,
              status: true,
              comment: true,
              decidedAt: true,
              approver: { select: { id: true, name: true } },
            },
            orderBy: { stepNumber: 'asc' },
          },
        },
      })

      if (!request) {
        throw notFound('비정기 보상 요청을 찾을 수 없습니다.')
      }

      // SalaryBand 조회
      const assignment = request.employee.assignments[0]
      let salaryBand = null

      if (assignment?.jobGradeId) {
        const band = await prisma.salaryBand.findFirst({
          where: {
            companyId: user.companyId,
            jobGradeId: assignment.jobGradeId,
            deletedAt: null,
          },
          orderBy: { effectiveFrom: 'desc' },
          select: { minSalary: true, midSalary: true, maxSalary: true },
        })

        if (band) {
          salaryBand = {
            minSalary: Number(band.minSalary),
            midSalary: Number(band.midSalary),
            maxSalary: Number(band.maxSalary),
          }
        }
      }

      return apiSuccess({
        id: request.id,
        companyId: request.companyId,
        employeeId: request.employeeId,
        employeeName: request.employee.name,
        department: assignment?.department ?? null,
        jobGrade: assignment?.jobGrade ?? null,
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
        currentStep: request.currentStep,
        totalSteps: request.totalSteps,
        submittedAt: request.submittedAt,
        completedAt: request.completedAt,
        compensationHistoryId: request.compensationHistoryId,
        triggerEventType: request.triggerEventType,
        triggerEventId: request.triggerEventId,
        salaryBand,
        approvalSteps: request.approvalSteps.map((s) => ({
          id: s.id,
          stepNumber: s.stepNumber,
          roleRequired: s.roleRequired,
          status: s.status,
          comment: s.comment,
          decidedAt: s.decidedAt,
          approverName: s.approver?.name ?? null,
        })),
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
      })
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.COMPENSATION, ACTION.VIEW),
)

// ─── PUT /api/v1/compensation/off-cycle/[id] ────────────────

export const PUT = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const body: unknown = await req.json()
    const parsed = offCycleUpdateSchema.safeParse(body)

    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    try {
      const request = await prisma.offCycleCompRequest.findFirst({
        where: { id, companyId: user.companyId },
      })

      if (!request) {
        throw notFound('비정기 보상 요청을 찾을 수 없습니다.')
      }

      if (request.status !== 'DRAFT') {
        throw badRequest('초안(DRAFT) 상태의 요청만 수정할 수 있습니다.')
      }

      if (request.initiatorId !== user.employeeId) {
        throw forbidden('요청을 발의한 사람만 수정할 수 있습니다.')
      }

      const updateData: Record<string, unknown> = {}
      const { reasonCategory, reason, proposedBaseSalary, effectiveDate } = parsed.data

      if (reasonCategory !== undefined) updateData.reasonCategory = reasonCategory
      if (reason !== undefined) updateData.reason = reason
      if (effectiveDate !== undefined) updateData.effectiveDate = new Date(effectiveDate)

      // proposedBaseSalary 변경 시 changePct, proposedCompaRatio 재계산
      if (proposedBaseSalary !== undefined) {
        updateData.proposedBaseSalary = proposedBaseSalary
        const currentBaseSalary = Number(request.currentBaseSalary)
        updateData.changePct = Math.round(((proposedBaseSalary - currentBaseSalary) / currentBaseSalary) * 10000) / 100

        // SalaryBand → proposedCompaRatio 재계산
        const assignment = await prisma.employeeAssignment.findFirst({
          where: { employeeId: request.employeeId, isPrimary: true, endDate: null },
          select: { jobGradeId: true },
        })

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
            updateData.proposedCompaRatio = calculateCompaRatio(proposedBaseSalary, Number(band.midSalary))
          }
        }
      }

      const updated = await prisma.offCycleCompRequest.update({
        where: { id },
        data: updateData,
        include: {
          employee: { select: { id: true, name: true } },
          initiator: { select: { id: true, name: true } },
        },
      })

      return apiSuccess({
        id: updated.id,
        employeeId: updated.employeeId,
        employeeName: updated.employee.name,
        initiatorId: updated.initiatorId,
        initiatorName: updated.initiator.name,
        reasonCategory: updated.reasonCategory,
        reason: updated.reason,
        currentBaseSalary: Number(updated.currentBaseSalary),
        proposedBaseSalary: Number(updated.proposedBaseSalary),
        currency: updated.currency,
        changePct: Number(updated.changePct),
        proposedCompaRatio: updated.proposedCompaRatio ? Number(updated.proposedCompaRatio) : null,
        effectiveDate: updated.effectiveDate,
        status: updated.status,
        updatedAt: updated.updatedAt,
      })
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.COMPENSATION, ACTION.UPDATE),
)
