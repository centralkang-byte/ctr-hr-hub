import { type NextRequest } from 'next/server'
import { v4 as uuid } from 'uuid'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, isAppError, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { documentListSchema, documentUploadSchema } from '@/lib/schemas/hr-chat'
import { generateEmbedding, chunkText } from '@/lib/embedding'
import { insertChunkWithEmbedding } from '@/lib/vector-search'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (
    req: NextRequest,
    _context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    try {
      const params = Object.fromEntries(req.nextUrl.searchParams.entries())
      const parsed = documentListSchema.safeParse(params)
      if (!parsed.success) {
        throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
      }

      const { page, limit, docType, search, isActive } = parsed.data

      const where: Record<string, unknown> = {
        companyId: user.companyId,
        deletedAt: null,
      }
      if (docType) where.docType = docType
      if (isActive !== undefined) where.isActive = isActive
      if (search) {
        where.title = { contains: search, mode: 'insensitive' }
      }

      const [items, total] = await Promise.all([
        prisma.hrDocument.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            uploader: { select: { name: true } },
            _count: { select: { chunks: true } },
          },
        }),
        prisma.hrDocument.count({ where }),
      ])

      return apiPaginated(items, buildPagination(page, limit, total))
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.HR_CHATBOT, ACTION.VIEW),
)

export const POST = withPermission(
  async (
    req: NextRequest,
    _context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    try {
      const body: unknown = await req.json()
      const parsed = documentUploadSchema.safeParse(body)
      if (!parsed.success) {
        throw badRequest('입력값이 올바르지 않습니다.', {
          issues: parsed.error.issues,
        })
      }

      const { title, docType, contentText, version, locale } = parsed.data

      // Create document
      const document = await prisma.hrDocument.create({
        data: {
          companyId: user.companyId,
          title,
          docType,
          contentText,
          version,
          locale,
          uploadedBy: user.employeeId,
        },
      })

      // Chunk and embed in background
      const chunks = chunkText(contentText)
      for (let i = 0; i < chunks.length; i++) {
        try {
          const embedding = await generateEmbedding(chunks[i])
          await insertChunkWithEmbedding({
            id: uuid(),
            documentId: document.id,
            chunkIndex: i,
            content: chunks[i],
            embedding,
            tokenCount: Math.ceil(chunks[i].length / 4),
            metadata: { title, docType, chunkOf: chunks.length },
          })
        } catch {
          // Log but don't fail the upload
          console.error(
            `Failed to embed chunk ${i} of document ${document.id}`,
          )
        }
      }

      const meta = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'hr_document.create',
        resourceType: 'hr_document',
        resourceId: document.id,
        companyId: user.companyId,
        ip: meta.ip,
        userAgent: meta.userAgent,
      })

      return apiSuccess(document, 201)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.HR_CHATBOT, ACTION.CREATE),
)
