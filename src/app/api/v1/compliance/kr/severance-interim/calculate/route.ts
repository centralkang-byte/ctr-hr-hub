// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Severance Pre-calculation
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { apiSuccess } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { badRequest, notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { severanceCalculateSchema } from '@/lib/schemas/compliance'
import { calculateSeveranceInterim } from '@/lib/compliance/kr'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = severanceCalculateSchema.safeParse(params)
    if (!parsed.success) throw badRequest('Invalid parameters', { issues: parsed.error.issues })

    // 비-SUPER는 본인 법인 직원만 — 최신 primary 발령 회사로 가드(전출자 현 법인 급여 누출 차단)
    const emp = await prisma.employee.findUnique({
      where: { id: parsed.data.employeeId },
      select: { assignments: { where: { isPrimary: true, effectiveDate: { lte: new Date() } }, orderBy: { effectiveDate: 'desc' }, take: 1, select: { companyId: true } } },
    })
    const empCompany = emp?.assignments[0]?.companyId
    if (!emp || (user.role !== ROLE.SUPER_ADMIN && empCompany !== user.companyId)) {
      throw notFound('직원을 찾을 수 없습니다.')
    }

    const result = await calculateSeveranceInterim(parsed.data.employeeId)
    if (!result) throw badRequest('Employee not found')

    return apiSuccess(result)
  },
  perm(MODULE.COMPLIANCE, ACTION.VIEW),
)
