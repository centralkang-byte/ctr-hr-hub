// ═══════════════════════════════════════════════════════════
// GET  /api/v1/payroll/import-mappings?companyId=X  — 매핑 목록
// POST /api/v1/payroll/import-mappings               — 매핑 생성
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermission } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess, apiError } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { z } from 'zod'

const createSchema = z.object({
  companyId: z.string(),
  name: z.string().min(1),
  fileType: z.enum(['xlsx', 'csv']).default('xlsx'),
  headerRow: z.number().int().min(1).default(1),
  mappings: z.record(z.string(), z.string()),
  currency: z.string().length(3),
  isDefault: z.boolean().default(false),
})

export const GET = withPermission(
  async (req: NextRequest) => {
    const companyId = new URL(req.url).searchParams.get('companyId')
    if (!companyId) return apiError(badRequest('companyId required'))

    const mappings = await prisma.payrollImportMapping.findMany({
      where: { companyId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    })
    return apiSuccess(mappings)
  },
  { module: MODULE.PAYROLL, action: ACTION.VIEW }
)

export const POST = withPermission(
  async (req: NextRequest) => {
    const body = await req.json()
    const data = createSchema.parse(body)

    if (data.isDefault) {
      await prisma.payrollImportMapping.updateMany({
        where: { companyId: data.companyId, isDefault: true },
        data: { isDefault: false },
      })
    }

    const mapping = await prisma.payrollImportMapping.create({
      data: {
        id: crypto.randomUUID(),
        companyId: data.companyId,
        name: data.name,
        fileType: data.fileType,
        headerRow: data.headerRow,
        mappings: JSON.parse(JSON.stringify(data.mappings)),
        currency: data.currency,
        isDefault: data.isDefault,
      },
    })
    return apiSuccess(mapping, 201)
  },
  { module: MODULE.PAYROLL, action: ACTION.CREATE }
)
