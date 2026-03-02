// ═══════════════════════════════════════════════════════════
// CTR HR Hub — PUT /api/v1/bank-transfers/[id]/result
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { bankTransferResultUploadSchema } from '@/lib/schemas/bank-transfer'
import type { SessionUser } from '@/types'

// ─── PUT /api/v1/bank-transfers/[id]/result ──────────────

export const PUT = withPermission(
  async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id } = await context.params

    const body: unknown = await req.json()
    const parsed = bankTransferResultUploadSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { results } = parsed.data

    const companyFilter =
      user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

    const batch = await prisma.bankTransferBatch.findFirst({
      where: {
        id,
        ...companyFilter,
      },
      include: {
        items: true,
      },
    })

    if (!batch) {
      throw notFound('이체 배치를 찾을 수 없습니다.')
    }

    if (!['GENERATED', 'SUBMITTED'].includes(batch.status)) {
      throw badRequest('GENERATED 또는 SUBMITTED 상태의 배치만 결과를 업로드할 수 있습니다.')
    }

    try {
      const updated = await prisma.$transaction(async (tx) => {
        // Update individual items based on results
        for (const result of results) {
          const item = batch.items.find(
            (i) => i.employeeId === result.employeeId,
          )
          if (!item) continue

          await tx.bankTransferItem.update({
            where: { id: item.id },
            data: {
              status: result.status,
              errorMessage: result.errorMessage ?? null,
              transferredAt: result.transferredAt
                ? new Date(result.transferredAt)
                : result.status === 'SUCCESS'
                  ? new Date()
                  : null,
            },
          })
        }

        // Calculate counts from updated items
        const updatedItems = await tx.bankTransferItem.findMany({
          where: { batchId: id },
        })

        const successCount = updatedItems.filter(
          (i) => i.status === 'SUCCESS',
        ).length
        const failCount = updatedItems.filter(
          (i) => i.status === 'FAILED',
        ).length
        const cancelledCount = updatedItems.filter(
          (i) => i.status === 'CANCELLED',
        ).length
        const totalProcessed = successCount + failCount + cancelledCount
        const totalCount = updatedItems.length

        // Determine batch status
        let batchStatus: 'COMPLETED' | 'PARTIALLY_COMPLETED' | 'FAILED'
        if (successCount === totalCount) {
          batchStatus = 'COMPLETED'
        } else if (failCount === totalCount || (failCount > 0 && successCount === 0)) {
          batchStatus = 'FAILED'
        } else {
          batchStatus = 'PARTIALLY_COMPLETED'
        }

        // Only mark completed if all items are processed
        const finalStatus =
          totalProcessed < totalCount ? 'SUBMITTED' : batchStatus

        return tx.bankTransferBatch.update({
          where: { id },
          data: {
            status: finalStatus as 'SUBMITTED' | 'COMPLETED' | 'PARTIALLY_COMPLETED' | 'FAILED',
            successCount,
            failCount,
            completedAt:
              finalStatus === 'COMPLETED' ||
              finalStatus === 'PARTIALLY_COMPLETED' ||
              finalStatus === 'FAILED'
                ? new Date()
                : null,
          },
          include: {
            items: {
              orderBy: { createdAt: 'asc' },
            },
            _count: { select: { items: true } },
          },
        })
      })

      const meta = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: ACTION.UPDATE,
        resourceType: 'BankTransferBatch',
        resourceId: id,
        companyId: user.companyId,
        changes: {
          action: 'result_upload',
          resultCount: results.length,
          successCount: updated.successCount,
          failCount: updated.failCount,
          finalStatus: updated.status,
        },
        ip: meta.ip,
        userAgent: meta.userAgent,
      })

      return apiSuccess(updated)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.PAYROLL, ACTION.UPDATE),
)
