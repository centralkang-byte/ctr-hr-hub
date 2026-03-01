// ═══════════════════════════════════════════════════════════
// CTR HR Hub — CN Social Insurance Config List & Create
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import {
  socialInsuranceConfigSearchSchema,
  socialInsuranceConfigCreateSchema,
} from '@/lib/schemas/compliance'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/compliance/cn/social-insurance/config ──
// List social insurance configs with filters

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = socialInsuranceConfigSearchSchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { page, limit, insuranceType, city, isActive } = parsed.data
    const companyId = user.companyId

    const where = {
      companyId,
      ...(insuranceType ? { insuranceType } : {}),
      ...(city ? { city: { contains: city, mode: 'insensitive' as const } } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    }

    const [configs, total] = await Promise.all([
      prisma.socialInsuranceConfig.findMany({
        where,
        orderBy: [{ insuranceType: 'asc' }, { city: 'asc' }, { effectiveFrom: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.socialInsuranceConfig.count({ where }),
    ])

    const serialized = configs.map((c) => ({
      ...c,
      employerRate: Number(c.employerRate),
      employeeRate: Number(c.employeeRate),
      baseMin: Number(c.baseMin),
      baseMax: Number(c.baseMax),
    }))

    return apiPaginated(serialized, buildPagination(page, limit, total))
  },
  perm(MODULE.COMPLIANCE, ACTION.VIEW),
)

// ─── POST /api/v1/compliance/cn/social-insurance/config ─
// Create a new social insurance config

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = socialInsuranceConfigCreateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const {
      insuranceType,
      city,
      employerRate,
      employeeRate,
      baseMin,
      baseMax,
      effectiveFrom,
      effectiveTo,
    } = parsed.data

    try {
      const config = await prisma.socialInsuranceConfig.create({
        data: {
          companyId: user.companyId,
          insuranceType,
          city,
          employerRate,
          employeeRate,
          baseMin,
          baseMax,
          effectiveFrom: new Date(effectiveFrom),
          ...(effectiveTo ? { effectiveTo: new Date(effectiveTo) } : {}),
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'compliance.cn.socialInsuranceConfig.create',
        resourceType: 'socialInsuranceConfig',
        resourceId: config.id,
        companyId: config.companyId,
        changes: { insuranceType, city, employerRate, employeeRate },
        ip,
        userAgent,
      })

      return apiSuccess(
        {
          ...config,
          employerRate: Number(config.employerRate),
          employeeRate: Number(config.employeeRate),
          baseMin: Number(config.baseMin),
          baseMax: Number(config.baseMax),
        },
        201,
      )
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.COMPLIANCE, ACTION.CREATE),
)
