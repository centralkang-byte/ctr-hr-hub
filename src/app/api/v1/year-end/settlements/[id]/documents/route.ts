// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Year-End Documents API
// POST   /api/v1/year-end/settlements/[id]/documents
//        — upload document metadata (file already uploaded to storage by client)
// DELETE /api/v1/year-end/settlements/[id]/documents?docId=xxx
//        — delete document
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { AppError } from '@/lib/errors'
import type { SessionUser } from '@/types'

async function verifyOwnership(id: string, employeeId: string) {
  const settlement = await prisma.yearEndSettlement.findUnique({
    where: { id },
    select: { id: true, employeeId: true, status: true },
  })
  if (!settlement) throw new AppError(404, 'NOT_FOUND', '정산 정보를 찾을 수 없습니다.')
  if (settlement.employeeId !== employeeId) throw new AppError(403, 'FORBIDDEN', '접근 권한이 없습니다.')
  return settlement
}

// POST — upload document metadata
export const POST = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    try {
      const { id } = await context.params
      const settlement = await verifyOwnership(id, user.employeeId)

      if (settlement.status === 'submitted' || settlement.status === 'confirmed') {
        throw new AppError(400, 'BAD_REQUEST', '제출 완료된 정산에는 서류를 추가할 수 없습니다.')
      }

      const body = await req.json() as {
        documentType: string
        fileName: string
        filePath: string
        parsedData?: Record<string, unknown>
      }

      if (!body.documentType || !body.fileName || !body.filePath) {
        throw new AppError(400, 'BAD_REQUEST', '문서 정보가 필요합니다.')
      }

      const document = await prisma.yearEndDocument.create({
        data: {
          settlementId: id,
          documentType: body.documentType,
          fileName: body.fileName,
          filePath: body.filePath,
          parsedData: body.parsedData ? JSON.parse(JSON.stringify(body.parsedData)) : undefined,
        },
      })

      return apiSuccess(document, 201)
    } catch (error) {
      return apiError(error)
    }
  },
  perm(MODULE.PAYROLL, ACTION.VIEW),
)

// DELETE — delete document
export const DELETE = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    try {
      const { id } = await context.params
      await verifyOwnership(id, user.employeeId)

      const { searchParams } = new URL(req.url)
      const docId = searchParams.get('docId')

      if (!docId) {
        throw new AppError(400, 'BAD_REQUEST', '문서 ID가 필요합니다.')
      }

      const document = await prisma.yearEndDocument.findUnique({
        where: { id: docId },
      })

      if (!document || document.settlementId !== id) {
        throw new AppError(404, 'NOT_FOUND', '문서를 찾을 수 없습니다.')
      }

      await prisma.yearEndDocument.delete({ where: { id: docId } })

      return apiSuccess({ deleted: true })
    } catch (error) {
      return apiError(error)
    }
  },
  perm(MODULE.PAYROLL, ACTION.VIEW),
)
