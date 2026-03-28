// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/migration/jobs + POST /api/v1/migration/jobs
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { migrationJobListSchema, migrationJobCreateSchema } from '@/lib/schemas/migration'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/migration/jobs ─────────────────────────────

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = migrationJobListSchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { page, limit, status, dataScope } = parsed.data

    const companyFilter = user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

    const where = {
      ...companyFilter,
      ...(status ? { status } : {}),
      ...(dataScope ? { dataScope } : {}),
    }

    const [items, total] = await Promise.all([
      prisma.migrationJob.findMany({
        where,
        include: {
          _count: { select: { logs: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.migrationJob.count({ where }),
    ])

    return apiPaginated(items, buildPagination(page, limit, total))
  },
  perm(MODULE.SETTINGS, ACTION.VIEW),
)

// ─── POST /api/v1/migration/jobs ────────────────────────────

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = migrationJobCreateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const data = parsed.data

    try {
      const job = await prisma.migrationJob.create({
        data: {
          companyId: user.companyId,
          name: data.name,
          description: data.description ?? null,
          sourceType: data.sourceType,
          dataScope: data.dataScope,
          status: 'DRAFT',
          config: data.config ?? undefined,
          createdById: user.employeeId,
        },
        include: {
          _count: { select: { logs: true } },
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'migration_job.create',
        resourceType: 'migration_job',
        resourceId: job.id,
        companyId: user.companyId,
        changes: { name: data.name, sourceType: data.sourceType, dataScope: data.dataScope },
        ip,
        userAgent,
      })

      return apiSuccess(job, 201)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.SETTINGS, ACTION.CREATE),
)
