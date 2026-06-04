// ═══════════════════════════════════════════════════════════
// GET  /api/v1/payroll/import-logs?companyId=X&year=Y&month=Z — 업로드 이력
// POST /api/v1/payroll/import-logs                             — 업로드 기록 저장
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermission } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { badRequest, forbidden } from '@/lib/errors'
import { resolveCompanyId } from '@/lib/api/companyFilter'
import { z } from 'zod'
import type { SessionUser } from '@/types'

const createSchema = z.object({
  companyId: z.string(),
  mappingId: z.string(),
  year: z.number().int(),
  month: z.number().int(),
  fileName: z.string(),
  employeeCount: z.number().int().default(0),
  totalGross: z.number().default(0),
  totalNet: z.number().default(0),
  currency: z.string().length(3),
  uploadedById: z.string(),
})

export const GET = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    const url = new URL(req.url)
    const companyId = resolveCompanyId(user, url.searchParams.get('companyId'))
    const year = url.searchParams.get('year') ? Number(url.searchParams.get('year')) : undefined
    const month = url.searchParams.get('month') ? Number(url.searchParams.get('month')) : undefined

    const logs = await prisma.payrollImportLog.findMany({
      where: {
        companyId,
        ...(year && { year }),
        ...(month && { month }),
      },
      include: {
        mapping: { select: { name: true, currency: true } },
        company: { select: { name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return apiSuccess(logs)
  },
  { module: MODULE.PAYROLL, action: ACTION.VIEW }
)

export const POST = withPermission(
  async (req: NextRequest, _ctx, user) => {
    const body = await req.json()
    const data = createSchema.parse(body)
    // 멀티테넌트 가드: SUPER_ADMIN 외에는 본인 법인 로그만 생성 + uploadedById spoof 방지
    if (user.role !== ROLE.SUPER_ADMIN && data.companyId !== user.companyId) {
      throw forbidden('다른 법인의 업로드 기록을 생성할 수 없습니다.')
    }
    // 매핑이 동일 법인 소속인지 검증 (타법인 매핑 참조로 메타 누출 차단)
    const mapping = await prisma.payrollImportMapping.findFirst({
      where: { id: data.mappingId, companyId: data.companyId },
      select: { id: true },
    })
    if (!mapping) throw badRequest('해당 법인의 유효한 매핑이 아닙니다.')

    const log = await prisma.payrollImportLog.create({
      data: {
        id: crypto.randomUUID(),
        ...data,
        status: 'uploaded',
        uploadedById: user.id,
      },
    })
    return apiSuccess(log, 201)
  },
  { module: MODULE.PAYROLL, action: ACTION.CREATE }
)
