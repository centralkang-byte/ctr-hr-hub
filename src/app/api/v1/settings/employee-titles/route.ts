// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /api/v1/settings/employee-titles
// 호칭 CRUD (법인별, 직급과 독립)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, conflict } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { resolveCompanyId } from '@/lib/api/companyFilter'
import { countCurrentOrFutureAssignmentMasterReferences } from '@/lib/employee/assignment-master-lifecycle'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (_req: NextRequest, _context, user: SessionUser) => {
    const companyFilter =
      user.role === 'SUPER_ADMIN' ? {} : { companyId: user.companyId }

    const titles = await prisma.employeeTitle.findMany({
      where: {
        deletedAt: null,
        ...companyFilter,
      },
      select: {
        id: true,
        code: true,
        name: true,
        nameEn: true,
        rankOrder: true,
        isExecutive: true,
        companyId: true,
      },
      orderBy: { rankOrder: 'asc' },
    })

    return apiSuccess(titles)
  },
  perm(MODULE.ORG, ACTION.VIEW),
)

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body = await req.json() as {
      companyId?: string
      code?: string
      name?: string
      nameEn?: string
      rankOrder?: number
      isExecutive?: boolean
    }

    if (!body.code || !body.name || body.rankOrder == null) {
      throw badRequest('code, name, rankOrder는 필수입니다.')
    }

    const companyId = resolveCompanyId(user, body.companyId)

    // @@unique 제약으로 중복 자동 차단되지만 명시적 에러 메시지 제공
    const existing = await prisma.employeeTitle.findUnique({
      where: { companyId_code: { companyId, code: body.code } },
    })
    if (existing) throw conflict(`동일 코드(${body.code})의 호칭이 이미 존재합니다.`)

    const title = await prisma.employeeTitle.create({
      data: {
        companyId,
        code: body.code,
        name: body.name,
        nameEn: body.nameEn,
        rankOrder: body.rankOrder,
        isExecutive: body.isExecutive ?? false,
      },
    })

    return apiSuccess(title, 201)
  },
  perm(MODULE.SETTINGS, ACTION.UPDATE),
)

export const PUT = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) throw badRequest('id 파라미터가 필요합니다.')

    const title = await prisma.employeeTitle.findFirst({
      where: { id, deletedAt: null },
    })
    if (!title) throw notFound('호칭을 찾을 수 없습니다.')

    if (user.role !== 'SUPER_ADMIN' && title.companyId !== user.companyId) {
      throw badRequest('다른 법인의 호칭은 수정할 수 없습니다.')
    }

    const body = await req.json() as {
      name?: string
      nameEn?: string
      rankOrder?: number
      isExecutive?: boolean
    }

    const updated = await prisma.employeeTitle.update({
      where: { id },
      data: {
        ...(body.name != null ? { name: body.name } : {}),
        ...(body.nameEn !== undefined ? { nameEn: body.nameEn } : {}),
        ...(body.rankOrder != null ? { rankOrder: body.rankOrder } : {}),
        ...(body.isExecutive != null ? { isExecutive: body.isExecutive } : {}),
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

    await prisma.$transaction(async (tx) => {
      const [title] = await tx.$queryRaw<Array<{
        id: string
        companyId: string
        deletedAt: Date | null
      }>>`
        SELECT id, company_id AS "companyId", deleted_at AS "deletedAt"
        FROM employee_titles
        WHERE id = ${id}
        FOR UPDATE
      `
      if (!title || title.deletedAt) throw notFound('호칭을 찾을 수 없습니다.')

      if (user.role !== 'SUPER_ADMIN' && title.companyId !== user.companyId) {
        throw badRequest('다른 법인의 호칭은 삭제할 수 없습니다.')
      }

      // FK 보호: 현재 또는 예정 assignment 확인
      const assignmentCount = await countCurrentOrFutureAssignmentMasterReferences(
        tx,
        title.companyId,
        [{ titleId: id }],
      )
      if (assignmentCount > 0) {
        throw conflict(`이 호칭을 현재 또는 예정 발령에서 사용 중인 직원이 ${assignmentCount}명 있어 삭제할 수 없습니다.`)
      }

      const deleted = await tx.employeeTitle.updateMany({
        where: { id, deletedAt: null },
        data: { deletedAt: new Date() },
      })
      if (deleted.count !== 1) throw notFound('호칭을 찾을 수 없습니다.')
    })

    return apiSuccess({ deleted: true })
  },
  perm(MODULE.SETTINGS, ACTION.DELETE),
)
