// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET/POST /api/v1/leave-of-absence/types
// 휴직 유형 목록 조회 + 생성
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/leave-of-absence/types ──────────────────

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const companyId = req.nextUrl.searchParams.get('companyId') ?? user.companyId

    const types = await prisma.leaveOfAbsenceType.findMany({
      where: {
        companyId,
        deletedAt: null,
      },
      orderBy: { sortOrder: 'asc' },
    })

    return apiSuccess(types)
  },
  perm(MODULE.LEAVE, ACTION.VIEW),
)

// ─── POST /api/v1/leave-of-absence/types ─────────────────

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    try {
      const body = (await req.json()) as Record<string, unknown>
      const {
        code,
        name,
        nameEn,
        category,
        maxDurationDays,
        payType,
        payRate,
        paySource,
        eligibilityMonths,
        countsAsService,
        countsAsAttendance,
        splittable,
        maxSplitCount,
        requiresProof,
        proofDescription,
        advanceNoticeDays,
        reinstatementGuaranteed,
        sortOrder,
      } = body

      if (!code || typeof code !== 'string' || !code.trim())
        throw badRequest('코드는 필수입니다.')
      if (!name || typeof name !== 'string' || !name.trim())
        throw badRequest('유형명은 필수입니다.')
      if (!category || !['STATUTORY', 'CONTRACTUAL'].includes(category as string))
        throw badRequest('카테고리는 STATUTORY 또는 CONTRACTUAL이어야 합니다.')

      const created = await prisma.leaveOfAbsenceType.create({
        data: {
          companyId: user.companyId,
          code: (code as string).trim().toUpperCase(),
          name: (name as string).trim(),
          nameEn: nameEn ? (nameEn as string).trim() : null,
          category: category as string,
          maxDurationDays: maxDurationDays != null ? Number(maxDurationDays) : null,
          payType: (payType as string) ?? 'UNPAID',
          payRate: payRate != null ? Number(payRate) : null,
          paySource: (paySource as string) ?? null,
          eligibilityMonths: eligibilityMonths != null ? Number(eligibilityMonths) : null,
          countsAsService: countsAsService === true,
          countsAsAttendance: countsAsAttendance === true,
          splittable: splittable === true,
          maxSplitCount: maxSplitCount != null ? Number(maxSplitCount) : null,
          requiresProof: requiresProof === true,
          proofDescription: (proofDescription as string) ?? null,
          advanceNoticeDays: advanceNoticeDays != null ? Number(advanceNoticeDays) : null,
          reinstatementGuaranteed: reinstatementGuaranteed === true,
          sortOrder: sortOrder != null ? Number(sortOrder) : 0,
        },
      })

      return apiSuccess(created)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.SETTINGS, ACTION.CREATE),
)
