// ═══════════════════════════════════════════════════════════
// GET  /api/v1/payroll/import-logs?companyId=X&year=Y&month=Z — 업로드 이력
// POST /api/v1/payroll/import-logs                             — 업로드 기록 저장
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermission } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
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

    const log = await prisma.payrollImportLog.create({
      data: {
        id: crypto.randomUUID(),
        ...data,
        status: 'uploaded',
        uploadedById: data.uploadedById || user.id,
      },
    })
    return apiSuccess(log, 201)
  },
  { module: MODULE.PAYROLL, action: ACTION.CREATE }
)
