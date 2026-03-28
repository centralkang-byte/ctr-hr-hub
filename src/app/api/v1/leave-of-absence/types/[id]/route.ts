// ═══════════════════════════════════════════════════════════
// CTR HR Hub — PUT/DELETE /api/v1/leave-of-absence/types/[id]
// 휴직 유형 수정 + 삭제
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, conflict, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

type RouteContext = { params: Promise<Record<string, string>> }

// ─── PUT /api/v1/leave-of-absence/types/[id] ────────────

export const PUT = withPermission(
  async (req: NextRequest, context: RouteContext, user: SessionUser) => {
    try {
      const { id } = await context.params

      const existing = await prisma.leaveOfAbsenceType.findFirst({
        where: { id, companyId: user.companyId, deletedAt: null },
      })
      if (!existing) throw notFound('휴직 유형을 찾을 수 없습니다.')

      const body = (await req.json()) as Record<string, unknown>

      const updated = await prisma.leaveOfAbsenceType.update({
        where: { id },
        data: {
          name: body.name != null ? String(body.name).trim() : existing.name,
          nameEn: body.nameEn !== undefined ? (body.nameEn ? String(body.nameEn).trim() : null) : existing.nameEn,
          category: body.category != null ? String(body.category) : existing.category,
          maxDurationDays: body.maxDurationDays !== undefined ? (body.maxDurationDays != null ? Number(body.maxDurationDays) : null) : existing.maxDurationDays,
          payType: body.payType != null ? String(body.payType) : existing.payType,
          payRate: body.payRate !== undefined ? (body.payRate != null ? Number(body.payRate) : null) : existing.payRate,
          paySource: body.paySource !== undefined ? (body.paySource ? String(body.paySource) : null) : existing.paySource,
          eligibilityMonths: body.eligibilityMonths !== undefined ? (body.eligibilityMonths != null ? Number(body.eligibilityMonths) : null) : existing.eligibilityMonths,
          countsAsService: body.countsAsService != null ? body.countsAsService === true : existing.countsAsService,
          countsAsAttendance: body.countsAsAttendance != null ? body.countsAsAttendance === true : existing.countsAsAttendance,
          splittable: body.splittable != null ? body.splittable === true : existing.splittable,
          maxSplitCount: body.maxSplitCount !== undefined ? (body.maxSplitCount != null ? Number(body.maxSplitCount) : null) : existing.maxSplitCount,
          requiresProof: body.requiresProof != null ? body.requiresProof === true : existing.requiresProof,
          proofDescription: body.proofDescription !== undefined ? (body.proofDescription ? String(body.proofDescription) : null) : existing.proofDescription,
          advanceNoticeDays: body.advanceNoticeDays !== undefined ? (body.advanceNoticeDays != null ? Number(body.advanceNoticeDays) : null) : existing.advanceNoticeDays,
          reinstatementGuaranteed: body.reinstatementGuaranteed != null ? body.reinstatementGuaranteed === true : existing.reinstatementGuaranteed,
          sortOrder: body.sortOrder != null ? Number(body.sortOrder) : existing.sortOrder,
          isActive: body.isActive != null ? body.isActive === true : existing.isActive,
        },
      })

      return apiSuccess(updated)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.SETTINGS, ACTION.UPDATE),
)

// ─── DELETE /api/v1/leave-of-absence/types/[id] ──────────

export const DELETE = withPermission(
  async (_req: NextRequest, context: RouteContext, user: SessionUser) => {
    try {
      const { id } = await context.params

      const existing = await prisma.leaveOfAbsenceType.findFirst({
        where: { id, companyId: user.companyId, deletedAt: null },
      })
      if (!existing) throw notFound('휴직 유형을 찾을 수 없습니다.')

      // 활성 휴직 기록이 있으면 삭제 불가
      const activeRecords = await prisma.leaveOfAbsence.count({
        where: {
          typeId: id,
          status: { in: ['REQUESTED', 'APPROVED', 'ACTIVE', 'RETURN_REQUESTED'] },
        },
      })
      if (activeRecords > 0) {
        throw conflict(`이 유형으로 진행 중인 휴직이 ${activeRecords}건 있어 삭제할 수 없습니다.`)
      }

      // Soft delete
      await prisma.leaveOfAbsenceType.update({
        where: { id },
        data: { deletedAt: new Date() },
      })

      return apiSuccess({ id })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.SETTINGS, ACTION.DELETE),
)
