// ═══════════════════════════════════════════════════════════
// POST /api/v1/employees/[id]/assignments/concurrent
// 겸직(secondary) 추가 API — B-3l
// ═══════════════════════════════════════════════════════════
import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound, forbidden, badRequest, conflict } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { fetchPrimaryAssignment } from '@/lib/employee/assignment-helpers'
import type { SessionUser } from '@/types'

export const POST = withPermission(
  async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id: employeeId } = await context.params

    // ── 1. Role check: HR_ADMIN or SUPER_ADMIN only ──────────
    if (user.role !== ROLE.SUPER_ADMIN && user.role !== ROLE.HR_ADMIN) {
      throw forbidden('HR_ADMIN 또는 SUPER_ADMIN만 겸직을 추가할 수 있습니다.')
    }

    // ── 2. Parse & validate request body ─────────────────────
    const body = await req.json()
    const {
      companyId,
      departmentId,
      jobGradeId,
      positionId,
      employmentType,
      effectiveDate,
      reason,
    } = body as {
      companyId: string
      departmentId: string | null
      jobGradeId: string | null
      positionId: string | null
      employmentType: string
      effectiveDate: string
      reason: string | null
    }

    if (!companyId || !employmentType || !effectiveDate) {
      throw badRequest('companyId, employmentType, effectiveDate는 필수입니다.')
    }

    // ── 3. HR_ADMIN scope: can only add concurrent within own company ──
    if (user.role === ROLE.HR_ADMIN && companyId !== user.companyId) {
      throw forbidden('자사 소속 법인에만 겸직을 추가할 수 있습니다.')
    }

    // ── 4. Verify employee exists ────────────────────────────
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, deletedAt: null },
      select: { id: true },
    })
    if (!employee) throw notFound('직원을 찾을 수 없습니다.')

    // ── 5. HR_ADMIN scope: employee's primary assignment company must match caller ──
    if (user.role === ROLE.HR_ADMIN) {
      const primary = await fetchPrimaryAssignment(employeeId)
      if (!primary || primary.companyId !== user.companyId) {
        throw forbidden('자사 소속 직원에 대해서만 겸직을 추가할 수 있습니다.')
      }
    }

    // ── 6. Duplicate check ───────────────────────────────────
    const existing = await prisma.employeeAssignment.findFirst({
      where: {
        employeeId,
        companyId,
        departmentId: departmentId ?? null,
        positionId: positionId ?? null,
        isPrimary: false,
        endDate: null,
      },
    })
    if (existing) {
      throw conflict('동일한 법인/부서/직위의 활성 겸직이 이미 존재합니다.')
    }

    // ── 7. Create concurrent assignment ──────────────────────
    const assignment = await prisma.employeeAssignment.create({
      data: {
        employeeId,
        companyId,
        departmentId,
        jobGradeId,
        positionId,
        employmentType,
        effectiveDate: new Date(effectiveDate),
        reason,
        isPrimary: false,
        changeType: 'CONCURRENT',
        status: 'ACTIVE',
        approvedById: user.employeeId,
      },
      include: {
        company: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        jobGrade: { select: { id: true, name: true, code: true } },
        position: { select: { id: true, titleKo: true, titleEn: true } },
      },
    })

    return apiSuccess(assignment, 201)
  },
  perm(MODULE.EMPLOYEES, ACTION.APPROVE),
)
