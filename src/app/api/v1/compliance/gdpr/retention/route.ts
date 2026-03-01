// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Data Retention Policy List & Create
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { retentionPolicySearchSchema, retentionPolicyCreateSchema } from '@/lib/schemas/compliance'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = retentionPolicySearchSchema.safeParse(params)
    if (!parsed.success) throw badRequest('Invalid parameters', { issues: parsed.error.issues })

    const { page, limit, category, isActive } = parsed.data
    const where = {
      companyId: user.companyId,
      ...(category ? { category } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    }

    const [policies, total] = await Promise.all([
      prisma.dataRetentionPolicy.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.dataRetentionPolicy.count({ where }),
    ])

    return apiPaginated(policies, buildPagination(page, limit, total))
  },
  perm(MODULE.COMPLIANCE, ACTION.VIEW),
)

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = retentionPolicyCreateSchema.safeParse(body)
    if (!parsed.success) throw badRequest('Invalid request data', { issues: parsed.error.issues })

    try {
      const policy = await prisma.dataRetentionPolicy.create({
        data: { companyId: user.companyId, ...parsed.data },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'compliance.gdpr.retention.create',
        resourceType: 'dataRetentionPolicy',
        resourceId: policy.id,
        companyId: user.companyId,
        changes: { category: parsed.data.category, retentionMonths: parsed.data.retentionMonths },
        ip, userAgent,
      })

      return apiSuccess(policy, 201)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.COMPLIANCE, ACTION.CREATE),
)
