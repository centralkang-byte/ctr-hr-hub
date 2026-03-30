// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /api/v1/settings/job-grades
// 직급 CRUD (법인별 가변 직급 체계)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, conflict } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const gradeType = searchParams.get('gradeType') // STAFF | SPECIALIST | EXECUTIVE

    const requestedCompanyId = searchParams.get('companyId')
    const companyFilter =
      requestedCompanyId ? { companyId: requestedCompanyId }
      : user.role === 'SUPER_ADMIN' ? {}
      : { companyId: user.companyId }

    const jobGrades = await prisma.jobGrade.findMany({
      where: {
        deletedAt: null,
        ...companyFilter,
        ...(gradeType ? { gradeType } : {}),
      },
      select: {
        id: true,
        code: true,
        name: true,
        nameEn: true,
        rankOrder: true,
        gradeType: true,
        minPromotionYears: true,
        companyId: true,
      },
      orderBy: { rankOrder: 'asc' },
    })

    return apiSuccess(jobGrades)
  },
  perm(MODULE.SETTINGS, ACTION.VIEW),
)

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body = await req.json() as {
      companyId?: string
      code?: string
      name?: string
      nameEn?: string
      rankOrder?: number
      gradeType?: string
      minPromotionYears?: number | null
    }

    if (!body.code || !body.name || body.rankOrder == null) {
      throw badRequest('code, name, rankOrder는 필수입니다.')
    }

    const companyId = body.companyId ?? user.companyId

    // 중복 코드 검사
    const existing = await prisma.jobGrade.findFirst({
      where: { companyId, code: body.code, deletedAt: null },
    })
    if (existing) throw conflict(`동일 코드(${body.code})의 직급이 이미 존재합니다.`)

    const grade = await prisma.jobGrade.create({
      data: {
        companyId,
        code: body.code,
        name: body.name,
        nameEn: body.nameEn,
        rankOrder: body.rankOrder,
        gradeType: body.gradeType ?? 'STAFF',
        minPromotionYears: body.minPromotionYears ?? null,
      },
    })

    return apiSuccess(grade, 201)
  },
  perm(MODULE.SETTINGS, ACTION.UPDATE),
)

export const PUT = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) throw badRequest('id 파라미터가 필요합니다.')

    const grade = await prisma.jobGrade.findFirst({
      where: { id, deletedAt: null },
    })
    if (!grade) throw notFound('직급을 찾을 수 없습니다.')

    // 법인 범위 검사
    if (user.role !== 'SUPER_ADMIN' && grade.companyId !== user.companyId) {
      throw badRequest('다른 법인의 직급은 수정할 수 없습니다.')
    }

    const body = await req.json() as {
      name?: string
      nameEn?: string
      rankOrder?: number
      gradeType?: string
      minPromotionYears?: number | null
    }

    const updated = await prisma.jobGrade.update({
      where: { id },
      data: {
        ...(body.name != null ? { name: body.name } : {}),
        ...(body.nameEn !== undefined ? { nameEn: body.nameEn } : {}),
        ...(body.rankOrder != null ? { rankOrder: body.rankOrder } : {}),
        ...(body.gradeType ? { gradeType: body.gradeType } : {}),
        ...(body.minPromotionYears !== undefined ? { minPromotionYears: body.minPromotionYears } : {}),
      },
    })

    return apiSuccess(updated)
  },
  perm(MODULE.SETTINGS, ACTION.UPDATE),
)

export const DELETE = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) throw badRequest('id 파라미터가 필요합니다.')

    const grade = await prisma.jobGrade.findFirst({
      where: { id, deletedAt: null },
    })
    if (!grade) throw notFound('직급을 찾을 수 없습니다.')

    if (user.role !== 'SUPER_ADMIN' && grade.companyId !== user.companyId) {
      throw badRequest('다른 법인의 직급은 삭제할 수 없습니다.')
    }

    // FK 보호: 활성 assignment 확인
    const activeAssignments = await prisma.employeeAssignment.count({
      where: { jobGradeId: id, endDate: null, status: 'ACTIVE' },
    })
    if (activeAssignments > 0) {
      throw conflict(`이 직급을 사용 중인 직원이 ${activeAssignments}명 있어 삭제할 수 없습니다.`)
    }

    // FK 보호: 활성 SalaryBand 확인
    const activeBands = await prisma.salaryBand.count({
      where: { jobGradeId: id },
    })
    if (activeBands > 0) {
      throw conflict(`이 직급에 연결된 급여 밴드가 ${activeBands}건 있어 삭제할 수 없습니다.`)
    }

    // Soft delete
    await prisma.jobGrade.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    return apiSuccess({ deleted: true })
  },
  perm(MODULE.SETTINGS, ACTION.DELETE),
)
