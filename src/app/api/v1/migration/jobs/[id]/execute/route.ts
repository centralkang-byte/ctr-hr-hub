// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/migration/jobs/[id]/execute
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { migrationExecuteSchema } from '@/lib/schemas/migration'
import { executeMigration } from '@/lib/migration'
import type { SessionUser } from '@/types'

// ─── POST /api/v1/migration/jobs/[id]/execute ───────────────

export const POST = withRateLimit(withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params

    const companyFilter = user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

    const job = await prisma.migrationJob.findFirst({
      where: { id, ...companyFilter },
    })

    if (!job) {
      throw notFound('마이그레이션 작업을 찾을 수 없습니다.')
    }

    // Only allow execution of VALIDATED jobs
    if (job.status !== 'VALIDATED') {
      throw badRequest('VALIDATED 상태의 작업만 실행할 수 있습니다. 먼저 데이터 검증을 수행하세요.')
    }

    const body: unknown = await req.json()
    const parsed = migrationExecuteSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { data } = parsed.data

    try {
      // Update status to RUNNING
      await prisma.migrationJob.update({
        where: { id },
        data: {
          status: 'RUNNING',
          totalRecords: data.length,
          processedRecords: 0,
          successRecords: 0,
          errorRecords: 0,
          startedAt: new Date(),
        },
      })

      // Log migration start
      await prisma.migrationLog.create({
        data: {
          jobId: id,
          level: 'INFO',
          message: `마이그레이션 시작: 총 ${data.length}건 처리 예정 (scope: ${job.dataScope})`,
        },
      })

      // Execute migration (processes records one by one)
      await executeMigration(id, job.dataScope, data)

      // Fetch updated job
      const updatedJob = await prisma.migrationJob.findUnique({
        where: { id },
        include: {
          _count: { select: { logs: true } },
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'migration_job.execute',
        resourceType: 'migration_job',
        resourceId: id,
        companyId: user.companyId,
        changes: {
          totalRecords: updatedJob?.totalRecords,
          successRecords: updatedJob?.successRecords,
          errorRecords: updatedJob?.errorRecords,
          status: updatedJob?.status,
        },
        ip,
        userAgent,
      })

      return apiSuccess(updatedJob)
    } catch (error) {
      // Update job status to FAILED on unexpected error
      await prisma.migrationJob.update({
        where: { id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
        },
      }).catch(() => { /* ignore update failure */ })

      await prisma.migrationLog.create({
        data: {
          jobId: id,
          level: 'ERROR',
          message: `마이그레이션 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
        },
      }).catch(() => { /* ignore log failure */ })

      throw handlePrismaError(error)
    }
  },
  perm(MODULE.SETTINGS, ACTION.CREATE),
), RATE_LIMITS.BULK)
