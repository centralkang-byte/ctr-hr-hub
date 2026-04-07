// ═══════════════════════════════════════════════════════════
// POST /api/v1/leave-of-absence/types/apply-defaults
// 글로벌 기본 휴직유형을 법인에 적용 (이미 있는 code는 건너뜀)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { resolveCompanyId } from '@/lib/api/companyFilter'
import { MODULE, ACTION } from '@/lib/constants'
import { KR_LOA_DEFAULTS } from '@/lib/loa/default-types'
import type { SessionUser } from '@/types'

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body = (await req.json()) as { companyId?: string }
    const companyId = resolveCompanyId(user, body.companyId)

    if (!companyId) throw badRequest('법인 ID가 필요합니다.')

    // 이미 있는 code 조회 (soft-deleted 포함 — unique 제약 충돌 방지)
    const existing = await prisma.leaveOfAbsenceType.findMany({
      where: { companyId },
      select: { code: true, deletedAt: true },
    })
    const existingCodes = new Set(existing.map(e => e.code))

    // 없는 유형만 생성
    const toCreate = KR_LOA_DEFAULTS.filter(d => !existingCodes.has(d.code))

    if (toCreate.length === 0) {
      return apiSuccess({ created: 0, skipped: existing.length, message: '이미 모든 기본 유형이 등록되어 있습니다.' })
    }

    await prisma.leaveOfAbsenceType.createMany({
      data: toCreate.map(d => ({
        companyId,
        code: d.code,
        name: d.name,
        nameEn: d.nameEn,
        category: d.category,
        maxDurationDays: d.maxDurationDays,
        payType: d.payType,
        payRate: d.payRate,
        paySource: d.paySource,
        eligibilityMonths: d.eligibilityMonths,
        countsAsService: d.countsAsService,
        countsAsAttendance: d.countsAsAttendance,
        splittable: d.splittable,
        maxSplitCount: d.maxSplitCount,
        requiresProof: d.requiresProof,
        proofDescription: d.proofDescription,
        advanceNoticeDays: d.advanceNoticeDays,
        reinstatementGuaranteed: d.reinstatementGuaranteed,
        sortOrder: d.sortOrder,
      })),
    })

    return apiSuccess({
      created: toCreate.length,
      skipped: existingCodes.size,
      message: `${toCreate.length}개 기본 유형이 추가되었습니다.`,
    })
  },
  perm(MODULE.SETTINGS, ACTION.CREATE),
)
