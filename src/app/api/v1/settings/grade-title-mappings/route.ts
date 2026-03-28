// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /api/v1/settings/grade-title-mappings
// 직급↔호칭 매핑 CRUD (Grade + Title + Mapping 동시 관리)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, conflict } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

// GET — 법인별 매핑 목록 (grade + title join)
export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const gradeType = searchParams.get('gradeType')
    const companyId = searchParams.get('companyId') ?? user.companyId

    // 법인 범위 검사
    if (user.role !== 'SUPER_ADMIN' && companyId !== user.companyId) {
      throw badRequest('다른 법인의 매핑을 조회할 수 없습니다.')
    }

    const mappings = await prisma.gradeTitleMapping.findMany({
      where: {
        companyId,
        jobGrade: {
          deletedAt: null,
          ...(gradeType ? { gradeType } : {}),
        },
      },
      include: {
        jobGrade: {
          select: {
            id: true,
            code: true,
            name: true,
            nameEn: true,
            gradeType: true,
            rankOrder: true,
          },
        },
        employeeTitle: {
          select: {
            id: true,
            code: true,
            name: true,
            nameEn: true,
            isExecutive: true,
            rankOrder: true,
          },
        },
      },
      orderBy: { jobGrade: { rankOrder: 'asc' } },
    })

    return apiSuccess(mappings)
  },
  perm(MODULE.SETTINGS, ACTION.VIEW),
)

// POST — Grade + Title + Mapping 동시 생성 (트랜잭션)
export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body = await req.json() as {
      companyId?: string
      gradeCode: string
      gradeName?: string
      gradeNameEn?: string
      gradeType: 'STAFF' | 'EXECUTIVE' | 'SPECIALIST'
      rankOrder: number
      titleName: string
      titleNameEn?: string
    }

    if (!body.gradeCode || !body.gradeType || body.rankOrder == null || !body.titleName) {
      throw badRequest('gradeCode, gradeType, rankOrder, titleName은 필수입니다.')
    }

    const companyId = body.companyId ?? user.companyId

    if (user.role !== 'SUPER_ADMIN' && companyId !== user.companyId) {
      throw badRequest('다른 법인에 매핑을 생성할 수 없습니다.')
    }

    // 중복 grade code 검사
    const existingGrade = await prisma.jobGrade.findFirst({
      where: { companyId, code: body.gradeCode, deletedAt: null },
    })
    if (existingGrade) {
      throw conflict(`동일 코드(${body.gradeCode})의 직급이 이미 존재합니다.`)
    }

    // title code 생성 (gradeCode 기반)
    const titleCode = `TITLE_${body.gradeCode}`

    // 트랜잭션: Grade + Title + Mapping 동시 생성
    const result = await prisma.$transaction(async (tx) => {
      const grade = await tx.jobGrade.create({
        data: {
          companyId,
          code: body.gradeCode,
          name: body.gradeName ?? body.gradeCode,
          nameEn: body.gradeNameEn ?? body.gradeCode,
          gradeType: body.gradeType,
          rankOrder: body.rankOrder,
        },
      })

      const title = await tx.employeeTitle.create({
        data: {
          companyId,
          code: titleCode,
          name: body.titleName,
          nameEn: body.titleNameEn ?? body.titleName,
          rankOrder: body.rankOrder,
          isExecutive: body.gradeType === 'EXECUTIVE',
        },
      })

      const mapping = await tx.gradeTitleMapping.create({
        data: {
          companyId,
          jobGradeId: grade.id,
          employeeTitleId: title.id,
        },
        include: {
          jobGrade: {
            select: { id: true, code: true, name: true, gradeType: true, rankOrder: true },
          },
          employeeTitle: {
            select: { id: true, code: true, name: true, isExecutive: true },
          },
        },
      })

      return mapping
    })

    return apiSuccess(result, 201)
  },
  perm(MODULE.SETTINGS, ACTION.UPDATE),
)

// PUT — 매핑 수정 (title 이름 변경, rankOrder 변경)
export const PUT = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) throw badRequest('id 파라미터가 필요합니다.')

    const mapping = await prisma.gradeTitleMapping.findUnique({
      where: { id },
      include: { jobGrade: true, employeeTitle: true },
    })
    if (!mapping) throw notFound('매핑을 찾을 수 없습니다.')

    if (user.role !== 'SUPER_ADMIN' && mapping.companyId !== user.companyId) {
      throw badRequest('다른 법인의 매핑은 수정할 수 없습니다.')
    }

    const body = await req.json() as {
      gradeName?: string
      gradeNameEn?: string
      titleName?: string
      titleNameEn?: string
      rankOrder?: number
    }

    const result = await prisma.$transaction(async (tx) => {
      // Grade 업데이트
      if (body.gradeName != null || body.gradeNameEn !== undefined || body.rankOrder != null) {
        await tx.jobGrade.update({
          where: { id: mapping.jobGradeId },
          data: {
            ...(body.gradeName != null ? { name: body.gradeName } : {}),
            ...(body.gradeNameEn !== undefined ? { nameEn: body.gradeNameEn } : {}),
            ...(body.rankOrder != null ? { rankOrder: body.rankOrder } : {}),
          },
        })
      }

      // Title 업데이트
      if (body.titleName != null || body.titleNameEn !== undefined || body.rankOrder != null) {
        await tx.employeeTitle.update({
          where: { id: mapping.employeeTitleId },
          data: {
            ...(body.titleName != null ? { name: body.titleName } : {}),
            ...(body.titleNameEn !== undefined ? { nameEn: body.titleNameEn } : {}),
            ...(body.rankOrder != null ? { rankOrder: body.rankOrder } : {}),
          },
        })
      }

      return tx.gradeTitleMapping.findUnique({
        where: { id },
        include: {
          jobGrade: {
            select: { id: true, code: true, name: true, gradeType: true, rankOrder: true },
          },
          employeeTitle: {
            select: { id: true, code: true, name: true, isExecutive: true },
          },
        },
      })
    })

    return apiSuccess(result)
  },
  perm(MODULE.SETTINGS, ACTION.UPDATE),
)

// DELETE — Grade + Mapping + Title soft delete (assignment 확인)
export const DELETE = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) throw badRequest('id 파라미터가 필요합니다.')

    const mapping = await prisma.gradeTitleMapping.findUnique({
      where: { id },
      include: { jobGrade: true },
    })
    if (!mapping) throw notFound('매핑을 찾을 수 없습니다.')

    if (user.role !== 'SUPER_ADMIN' && mapping.companyId !== user.companyId) {
      throw badRequest('다른 법인의 매핑은 삭제할 수 없습니다.')
    }

    // FK 보호: 활성 assignment 확인
    const activeAssignments = await prisma.employeeAssignment.count({
      where: { jobGradeId: mapping.jobGradeId, endDate: null, status: 'ACTIVE' },
    })
    if (activeAssignments > 0) {
      throw conflict(`이 직급을 사용 중인 직원이 ${activeAssignments}명 있어 삭제할 수 없습니다.`)
    }

    // 트랜잭션: Mapping 삭제 + Grade/Title soft delete
    await prisma.$transaction(async (tx) => {
      await tx.gradeTitleMapping.delete({ where: { id } })
      await tx.jobGrade.update({
        where: { id: mapping.jobGradeId },
        data: { deletedAt: new Date() },
      })
      await tx.employeeTitle.update({
        where: { id: mapping.employeeTitleId },
        data: { deletedAt: new Date() },
      })
    })

    return apiSuccess({ deleted: true })
  },
  perm(MODULE.SETTINGS, ACTION.DELETE),
)
