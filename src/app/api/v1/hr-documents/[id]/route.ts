import { type NextRequest } from 'next/server'
import { v4 as uuid } from 'uuid'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import {
  badRequest,
  notFound,
  isAppError,
  handlePrismaError,
} from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { documentUpdateSchema } from '@/lib/schemas/hr-chat'
import { generateEmbedding, chunkText } from '@/lib/embedding'
import {
  insertChunkWithEmbedding,
  deleteChunksByDocumentId,
} from '@/lib/vector-search'
import type { SessionUser } from '@/types'

export const PUT = withPermission(
  async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    try {
      const { id } = await context.params
      const body: unknown = await req.json()
      const parsed = documentUpdateSchema.safeParse(body)
      if (!parsed.success) {
        throw badRequest('입력값이 올바르지 않습니다.', {
          issues: parsed.error.issues,
        })
      }

      const existing = await prisma.hrDocument.findFirst({
        where: { id, companyId: user.companyId, deletedAt: null },
      })
      if (!existing) throw notFound('문서를 찾을 수 없습니다.')

      const updated = await prisma.hrDocument.update({
        where: { id },
        data: parsed.data,
      })

      // Re-generate chunks if content changed
      if (parsed.data.contentText) {
        await deleteChunksByDocumentId(id)

        const chunks = chunkText(parsed.data.contentText)
        for (let i = 0; i < chunks.length; i++) {
          try {
            const embedding = await generateEmbedding(chunks[i])
            await insertChunkWithEmbedding({
              id: uuid(),
              documentId: id,
              chunkIndex: i,
              content: chunks[i],
              embedding,
              tokenCount: Math.ceil(chunks[i].length / 4),
              metadata: {
                title: updated.title,
                docType: updated.docType,
                chunkOf: chunks.length,
              },
            })
          } catch {
            console.error(`Failed to embed chunk ${i} of document ${id}`)
          }
        }
      }

      const meta = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'hr_document.update',
        resourceType: 'hr_document',
        resourceId: id,
        companyId: user.companyId,
        ip: meta.ip,
        userAgent: meta.userAgent,
      })

      return apiSuccess(updated)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.HR_CHATBOT, ACTION.UPDATE),
)

export const DELETE = withPermission(
  async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    try {
      const { id } = await context.params

      const existing = await prisma.hrDocument.findFirst({
        where: { id, companyId: user.companyId, deletedAt: null },
      })
      if (!existing) throw notFound('문서를 찾을 수 없습니다.')

      // Delete chunks first
      await deleteChunksByDocumentId(id)

      // Soft delete
      await prisma.hrDocument.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      })

      const meta = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'hr_document.delete',
        resourceType: 'hr_document',
        resourceId: id,
        companyId: user.companyId,
        ip: meta.ip,
        userAgent: meta.userAgent,
      })

      return apiSuccess({ deleted: true })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.HR_CHATBOT, ACTION.DELETE),
)
