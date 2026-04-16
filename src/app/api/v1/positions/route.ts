// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /api/v1/positions
// GET: 법인별 직위 목록 / POST: 직위 생성
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { withPermission, perm } from '@/lib/permissions'
import { apiSuccess } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { MODULE, ACTION } from '@/lib/constants'
import { badRequest, handlePrismaError, isAppError } from '@/lib/errors'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest) => {
    const { searchParams } = new URL(req.url)
    const companyId = searchParams.get('companyId')
    const departmentId = searchParams.get('departmentId')

    const where: Record<string, unknown> = { deletedAt: null }
    if (companyId) where.companyId = companyId
    if (departmentId) where.departmentId = departmentId

    const positions = await prisma.position.findMany({
      where,
      select: {
        id: true,
        titleKo: true,
        titleEn: true,
        code: true,
        companyId: true,
        departmentId: true,
        reportsToPositionId: true,
        jobGradeId: true,
        reportsTo: { select: { id: true, titleKo: true } },
        jobGrade: { select: { id: true, name: true } },
      },
      orderBy: { titleKo: 'asc' },
    })

    // Map to common {id, name} format for dropdown compatibility (extra fields added for settings UI)
    const mapped = positions.map((p) => ({
      id: p.id,
      name: p.titleKo,
      nameEn: p.titleEn,
      code: p.code,
      companyId: p.companyId,
      departmentId: p.departmentId,
      reportsToPositionId: p.reportsToPositionId,
      reportsToName: p.reportsTo?.titleKo ?? null,
      jobGradeId: p.jobGradeId,
      jobGradeName: p.jobGrade?.name ?? null,
    }))

    return apiSuccess(mapped)
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)

export const POST = withPermission(
  async (req: NextRequest, _ctx: unknown, user: SessionUser) => {
    const body: unknown = await req.json()
    const { titleKo, titleEn, code, companyId, reportsToPositionId, jobGradeId } = body as Record<string, string | undefined>

    if (!titleKo?.trim()) throw badRequest('직위명(한국어)은 필수입니다.')
    if (!code?.trim()) throw badRequest('코드는 필수입니다.')

    const targetCompanyId = companyId ?? user.companyId

    try {
      const position = await prisma.position.create({
        data: {
          titleKo: titleKo.trim(),
          titleEn: titleEn?.trim() ?? titleKo.trim(),
          code: code.trim(),
          companyId: targetCompanyId,
          ...(reportsToPositionId ? { reportsToPositionId } : {}),
          ...(jobGradeId ? { jobGradeId } : {}),
        },
        select: {
          id: true, titleKo: true, titleEn: true, code: true, companyId: true,
          reportsTo: { select: { id: true, titleKo: true } },
          jobGrade: { select: { id: true, name: true } },
        },
      })
      return apiSuccess(position, 201)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.SETTINGS, ACTION.CREATE),
)
