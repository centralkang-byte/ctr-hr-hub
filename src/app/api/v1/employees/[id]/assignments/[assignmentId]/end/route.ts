// ═══════════════════════════════════════════════════════════
// PATCH /api/v1/employees/[id]/assignments/[assignmentId]/end
// 겸직 종료 API — B-3l
// ═══════════════════════════════════════════════════════════
import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound, forbidden, badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { fetchPrimaryAssignment } from '@/lib/employee/assignment-helpers'
import type { SessionUser } from '@/types'

export const PATCH = withPermission(
  async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id: employeeId, assignmentId } = await context.params

    // ── 1. Role check: HR_ADMIN or SUPER_ADMIN only ──────────
    if (user.role !== ROLE.SUPER_ADMIN && user.role !== ROLE.HR_ADMIN) {
      throw forbidden('HR_ADMIN 또는 SUPER_ADMIN만 겸직을 종료할 수 있습니다.')
    }

    // ── 2. Parse & validate request body ─────────────────────
    const body = await req.json()
    const { endDate, reason } = body as {
      endDate: string
      reason: string | null
    }

    if (!endDate) {
      throw badRequest('endDate는 필수입니다.')
    }

    // ── 3. Find assignment + verify employeeId match (IDOR protection) ──
    const assignment = await prisma.employeeAssignment.findFirst({
      where: {
        id: assignmentId,
        employeeId,
      },
    })
    if (!assignment) {
      throw notFound('해당 배치 이력을 찾을 수 없습니다.')
    }

    // ── 4. Must be secondary (isPrimary=false) ───────────────
    if (assignment.isPrimary) {
      throw badRequest('주 배치는 이 API로 종료할 수 없습니다.')
    }

    // ── 5. Must not already be ended ─────────────────────────
    if (assignment.endDate !== null) {
      throw badRequest('이미 종료된 겸직입니다.')
    }

    // ── 6. endDate must be >= effectiveDate ───────────────────
    const endDateParsed = new Date(endDate)
    const effectiveDateValue = new Date(assignment.effectiveDate)
    if (endDateParsed < effectiveDateValue) {
      throw badRequest('종료일은 발령일 이후여야 합니다.')
    }

    // ── 7. HR_ADMIN scope: employee's primary assignment company must match caller ──
    if (user.role === ROLE.HR_ADMIN) {
      const primary = await fetchPrimaryAssignment(employeeId)
      if (!primary || primary.companyId !== user.companyId) {
        throw forbidden('자사 소속 직원에 대해서만 겸직을 종료할 수 있습니다.')
      }
    }

    // ── 8. Update endDate (and reason if provided) ───────────
    const updated = await prisma.employeeAssignment.update({
      where: { id: assignmentId },
      data: {
        endDate: endDateParsed,
        status: 'TERMINATED',
        ...(reason !== undefined && reason !== null ? { reason } : {}),
      },
      include: {
        company: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        jobGrade: { select: { id: true, name: true, code: true } },
        position: { select: { id: true, titleKo: true, titleEn: true } },
      },
    })

    return apiSuccess(updated)
  },
  perm(MODULE.EMPLOYEES, ACTION.APPROVE),
)
