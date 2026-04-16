// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET/POST /api/v1/leave-of-absence
// 휴직 목록 조회 + 휴직 신청
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/leave-of-absence ────────────────────────

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const sp = req.nextUrl.searchParams
    const page = Math.max(1, Number(sp.get('page') ?? 1))
    const limit = Math.min(100, Math.max(1, Number(sp.get('limit') ?? 20)))
    const employeeId = sp.get('employeeId')
    const status = sp.get('status')
    const typeId = sp.get('typeId')
    const companyId = sp.get('companyId') ?? user.companyId

    const where: Record<string, unknown> = {
      companyId,
      deletedAt: null,
    }
    if (employeeId) where.employeeId = employeeId
    if (status) where.status = status
    if (typeId) where.typeId = typeId

    const [records, total] = await Promise.all([
      prisma.leaveOfAbsence.findMany({
        where,
        include: {
          employee: { select: { id: true, name: true, nameEn: true, employeeNo: true } },
          type: { select: { id: true, code: true, name: true, nameEn: true, category: true } },
          approver: { select: { id: true, name: true } },
        },
        orderBy: { requestedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.leaveOfAbsence.count({ where }),
    ])

    return apiPaginated(records, buildPagination(page, limit, total))
  },
  perm(MODULE.LEAVE, ACTION.UPDATE),
)

// ─── POST /api/v1/leave-of-absence ──────────────────────

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    try {
      const body = (await req.json()) as Record<string, unknown>
      const { employeeId, typeId, startDate, expectedEndDate, reason, proofFileUrl } = body

      // 검증
      if (!employeeId || typeof employeeId !== 'string')
        throw badRequest('직원 ID는 필수입니다.')
      if (!typeId || typeof typeId !== 'string')
        throw badRequest('휴직 유형은 필수입니다.')
      if (!startDate || typeof startDate !== 'string')
        throw badRequest('시작일은 필수입니다.')

      // 휴직 유형 존재 확인
      const loaType = await prisma.leaveOfAbsenceType.findFirst({
        where: { id: typeId, companyId: user.companyId, deletedAt: null },
      })
      if (!loaType) throw badRequest('유효하지 않은 휴직 유형입니다.')

      // 직원 존재 확인
      const employee = await prisma.employee.findFirst({
        where: { id: employeeId, deletedAt: null },
      })
      if (!employee) throw badRequest('직원을 찾을 수 없습니다.')

      // 증빙 필수 체크
      if (loaType.requiresProof && !proofFileUrl) {
        throw badRequest(`이 휴직 유형은 증빙 서류가 필수입니다. (${loaType.proofDescription ?? '증빙 서류'})`)
      }

      // 분할 사용 시 시퀀스 계산
      let splitSequence = 1
      if (loaType.splittable) {
        const existingSplits = await prisma.leaveOfAbsence.count({
          where: {
            employeeId,
            typeId,
            status: { notIn: ['CANCELLED', 'REJECTED'] },
            deletedAt: null,
          },
        })
        splitSequence = existingSplits + 1

        if (loaType.maxSplitCount && splitSequence > loaType.maxSplitCount) {
          throw badRequest(`최대 분할 횟수(${loaType.maxSplitCount}회)를 초과했습니다.`)
        }
      }

      const record = await prisma.leaveOfAbsence.create({
        data: {
          employeeId,
          companyId: user.companyId,
          typeId,
          startDate: new Date(startDate as string),
          expectedEndDate: expectedEndDate ? new Date(expectedEndDate as string) : null,
          status: 'REQUESTED',
          reason: reason ? String(reason) : null,
          proofFileUrl: proofFileUrl ? String(proofFileUrl) : null,
          splitSequence,
        },
        include: {
          employee: { select: { id: true, name: true, employeeNo: true } },
          type: { select: { id: true, code: true, name: true } },
        },
      })

      return apiSuccess(record)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.LEAVE, ACTION.UPDATE),
)
