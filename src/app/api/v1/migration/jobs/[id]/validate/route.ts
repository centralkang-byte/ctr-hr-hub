// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/migration/jobs/[id]/validate
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { migrationValidateSchema } from '@/lib/schemas/migration'
import { validateMigrationData } from '@/lib/migration'
import type { SessionUser } from '@/types'

// ─── POST /api/v1/migration/jobs/[id]/validate ──────────────

export const POST = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params

    const companyFilter = user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

    const job = await prisma.migrationJob.findFirst({
      where: { id, ...companyFilter },
    })

    if (!job) {
      throw notFound('마이그레이션 작업을 찾을 수 없습니다.')
    }

    const body: unknown = await req.json()
    const parsed = migrationValidateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { data } = parsed.data

    try {
      // Update status to VALIDATING
      await prisma.migrationJob.update({
        where: { id },
        data: {
          status: 'VALIDATING',
          totalRecords: data.length,
        },
      })

      // Run validation
      const result = await validateMigrationData(job.dataScope, data)

      // Update status based on result
      const newStatus = result.isValid ? 'VALIDATED' : 'FAILED'

      await prisma.migrationJob.update({
        where: { id },
        data: {
          status: newStatus,
          validationErrors: result.errors.length > 0
            ? JSON.parse(JSON.stringify(result.errors))
            : undefined,
        },
      })

      // Log validation result
      await prisma.migrationLog.create({
        data: {
          jobId: id,
          level: result.isValid ? 'INFO' : 'ERROR',
          message: result.isValid
            ? `검증 완료: 총 ${result.totalRecords}건 통과 (경고 ${result.warnings.length}건)`
            : `검증 실패: 총 ${result.totalRecords}건 중 오류 ${result.errors.length}건`,
          detail: {
            totalRecords: result.totalRecords,
            errorCount: result.errors.length,
            warningCount: result.warnings.length,
          },
        },
      })

      // Log individual errors
      if (result.errors.length > 0) {
        const errorLogs = result.errors.slice(0, 100).map((err) => ({
          jobId: id,
          level: 'ERROR' as const,
          message: `행 ${err.row}: ${err.field} - ${err.message}`,
          recordRef: `row-${err.row}`,
          detail: JSON.parse(JSON.stringify(err)),
        }))

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await prisma.migrationLog.createMany({ data: errorLogs as any })
      }

      // Log individual warnings
      if (result.warnings.length > 0) {
        const warningLogs = result.warnings.slice(0, 100).map((warn) => ({
          jobId: id,
          level: 'WARNING' as const,
          message: `행 ${warn.row}: ${warn.field} - ${warn.message}`,
          recordRef: `row-${warn.row}`,
          detail: JSON.parse(JSON.stringify(warn)),
        }))

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await prisma.migrationLog.createMany({ data: warningLogs as any })
      }

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'migration_job.validate',
        resourceType: 'migration_job',
        resourceId: id,
        companyId: user.companyId,
        changes: {
          status: newStatus,
          totalRecords: result.totalRecords,
          errors: result.errors.length,
          warnings: result.warnings.length,
        },
        ip,
        userAgent,
      })

      return apiSuccess(result)
    } catch (error) {
      // Revert to FAILED on unexpected error
      await prisma.migrationJob.update({
        where: { id },
        data: { status: 'FAILED' },
      }).catch(() => { /* ignore update failure */ })

      throw handlePrismaError(error)
    }
  },
  perm(MODULE.SETTINGS, ACTION.CREATE),
)
