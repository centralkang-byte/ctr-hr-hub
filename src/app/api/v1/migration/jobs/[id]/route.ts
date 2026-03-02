// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/migration/jobs/[id] + DELETE
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/migration/jobs/[id] ────────────────────────

export const GET = withPermission(
  async (_req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params

    const companyFilter = user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

    const job = await prisma.migrationJob.findFirst({
      where: { id, ...companyFilter },
      include: {
        logs: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        _count: { select: { logs: true } },
      },
    })

    if (!job) {
      throw notFound('마이그레이션 작업을 찾을 수 없습니다.')
    }

    return apiSuccess(job)
  },
  perm(MODULE.SETTINGS, ACTION.VIEW),
)

// ─── DELETE /api/v1/migration/jobs/[id] ─────────────────────

export const DELETE = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params

    const companyFilter = user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

    const job = await prisma.migrationJob.findFirst({
      where: { id, ...companyFilter },
    })

    if (!job) {
      throw notFound('마이그레이션 작업을 찾을 수 없습니다.')
    }

    // Only allow deletion of DRAFT or FAILED jobs
    if (job.status !== 'DRAFT' && job.status !== 'FAILED') {
      throw badRequest('DRAFT 또는 FAILED 상태의 작업만 삭제할 수 있습니다.')
    }

    try {
      await prisma.migrationJob.delete({
        where: { id },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'migration_job.delete',
        resourceType: 'migration_job',
        resourceId: id,
        companyId: user.companyId,
        changes: { name: job.name, status: job.status },
        ip,
        userAgent,
      })

      return apiSuccess({ id, deleted: true })
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.SETTINGS, ACTION.DELETE),
)
