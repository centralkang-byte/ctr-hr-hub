// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/bank-transfers/[id]/generate
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { generateTransferFile } from '@/lib/integrations/bank-transfer'
import type { SessionUser } from '@/types'

// ─── POST /api/v1/bank-transfers/[id]/generate ───────────

export const POST = withPermission(
  async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id } = await context.params

    const companyFilter =
      user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

    const batch = await prisma.bankTransferBatch.findFirst({
      where: {
        id,
        ...companyFilter,
      },
      include: {
        items: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!batch) {
      throw notFound('이체 배치를 찾을 수 없습니다.')
    }

    if (batch.status !== 'DRAFT') {
      throw badRequest('DRAFT 상태의 배치만 파일을 생성할 수 있습니다.')
    }

    if (batch.items.length === 0) {
      throw badRequest('이체 항목이 없습니다.')
    }

    try {
      // Update status to GENERATING
      await prisma.bankTransferBatch.update({
        where: { id },
        data: { status: 'GENERATING' },
      })

      // Generate the transfer file
      const transferItems = batch.items.map((item, index) => ({
        seq: index + 1,
        employeeName: item.employeeName,
        accountNumber: item.accountNumber,
        amount: Number(item.amount),
        accountHolder: item.accountHolder,
      }))

      const fileBuffer = generateTransferFile({
        batchId: batch.id,
        bankCode: batch.bankCode,
        format: batch.format,
        items: transferItems,
      })

      // Mock file URL (in production, upload to S3/storage)
      const mockFileUrl = `/files/bank-transfers/${batch.id}.${batch.format.toLowerCase()}`

      // Update batch to GENERATED
      const updated = await prisma.bankTransferBatch.update({
        where: { id },
        data: {
          status: 'GENERATED',
          fileUrl: mockFileUrl,
          generatedAt: new Date(),
        },
        include: {
          items: true,
          _count: { select: { items: true } },
        },
      })

      const meta = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: ACTION.UPDATE,
        resourceType: 'BankTransferBatch',
        resourceId: id,
        companyId: user.companyId,
        changes: {
          action: 'generate',
          fileUrl: mockFileUrl,
          fileSize: fileBuffer.length,
          itemCount: transferItems.length,
        },
        ip: meta.ip,
        userAgent: meta.userAgent,
      })

      return apiSuccess(updated)
    } catch (error) {
      // Revert status on failure
      await prisma.bankTransferBatch.update({
        where: { id },
        data: { status: 'DRAFT' },
      }).catch(() => {
        // Silently fail: best effort revert
      })

      throw handlePrismaError(error)
    }
  },
  perm(MODULE.PAYROLL, ACTION.CREATE),
)
