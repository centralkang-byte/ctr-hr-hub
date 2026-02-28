import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'

// ─── pgvector Search & Insert ──────────────────────────

export interface ChunkSearchResult {
  id: string
  documentId: string
  chunkIndex: number
  content: string
  similarity: number
  documentTitle: string
  docType: string
}

/**
 * Search similar chunks using pgvector cosine distance (<=>)
 */
export async function searchSimilarChunks(
  embedding: number[],
  companyId: string,
  topK: number = 5,
): Promise<ChunkSearchResult[]> {
  const vectorStr = `[${embedding.join(',')}]`

  const results = await prisma.$queryRaw<ChunkSearchResult[]>`
    SELECT
      c.id,
      c.document_id AS "documentId",
      c.chunk_index AS "chunkIndex",
      c.content,
      1 - (c.embedding <=> ${vectorStr}::vector) AS similarity,
      d.title AS "documentTitle",
      d.doc_type AS "docType"
    FROM hr_document_chunks c
    JOIN hr_documents d ON d.id = c.document_id
    WHERE d.company_id = ${companyId}
      AND d.is_active = true
      AND d.deleted_at IS NULL
    ORDER BY c.embedding <=> ${vectorStr}::vector
    LIMIT ${topK}
  `

  return results
}

/**
 * Insert a chunk with embedding vector using raw SQL (Prisma ORM doesn't support vector type)
 */
export async function insertChunkWithEmbedding(params: {
  id: string
  documentId: string
  chunkIndex: number
  content: string
  embedding: number[]
  tokenCount: number
  metadata?: Record<string, unknown>
}): Promise<void> {
  const vectorStr = `[${params.embedding.join(',')}]`
  const metadataJson = params.metadata
    ? JSON.stringify(params.metadata)
    : null

  await prisma.$executeRaw`
    INSERT INTO hr_document_chunks (id, document_id, chunk_index, content, embedding, token_count, metadata, created_at)
    VALUES (
      ${params.id},
      ${params.documentId},
      ${params.chunkIndex},
      ${params.content},
      ${vectorStr}::vector,
      ${params.tokenCount},
      ${metadataJson ? Prisma.raw(`'${metadataJson}'::jsonb`) : Prisma.raw('NULL')},
      NOW()
    )
  `
}

/**
 * Delete all chunks for a document
 */
export async function deleteChunksByDocumentId(
  documentId: string,
): Promise<void> {
  await prisma.hrDocumentChunk.deleteMany({
    where: { documentId },
  })
}
