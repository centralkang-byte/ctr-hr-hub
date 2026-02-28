// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Term Override API
// GET: 용어 목록 / POST: 용어 upsert
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { badRequest } from '@/lib/errors'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { termOverrideSearchSchema, termOverrideUpsertSchema } from '@/lib/schemas/settings'
import { handlePrismaError } from '@/lib/errors'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = termOverrideSearchSchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { page, limit } = parsed.data
    const where = { companyId: user.companyId }

    const [items, total] = await Promise.all([
      prisma.termOverride.findMany({
        where,
        orderBy: { termKey: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.termOverride.count({ where }),
    ])

    return apiPaginated(items, buildPagination(page, limit, total))
  },
  perm(MODULE.SETTINGS, ACTION.VIEW),
)

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = termOverrideUpsertSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { termKey, labelKo, labelEn, labelLocal } = parsed.data

    try {
      const result = await prisma.termOverride.upsert({
        where: {
          companyId_termKey: {
            companyId: user.companyId,
            termKey,
          },
        },
        update: { labelKo, labelEn, labelLocal },
        create: {
          companyId: user.companyId,
          termKey,
          labelKo,
          labelEn,
          labelLocal,
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'settings.term_override.upsert',
        resourceType: 'termOverride',
        resourceId: result.id,
        companyId: user.companyId,
        changes: { termKey, labelKo, labelEn, labelLocal },
        ip,
        userAgent,
      })

      return apiSuccess(result, 201)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.SETTINGS, ACTION.CREATE),
)
