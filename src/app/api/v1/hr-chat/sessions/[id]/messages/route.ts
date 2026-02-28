import { type NextRequest } from 'next/server'
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
import { messageCreateSchema } from '@/lib/schemas/hr-chat'
import { generateEmbedding } from '@/lib/embedding'
import { searchSimilarChunks } from '@/lib/vector-search'
import { callClaude } from '@/lib/claude'
import type { SessionUser } from '@/types'
import type { AiFeature } from '@/generated/prisma/client'

export const GET = withPermission(
  async (
    _req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    try {
      const { id } = await context.params

      const session = await prisma.hrChatSession.findFirst({
        where: {
          id,
          employeeId: user.employeeId,
          companyId: user.companyId,
        },
      })
      if (!session) throw notFound('채팅 세션을 찾을 수 없습니다.')

      const messages = await prisma.hrChatMessage.findMany({
        where: { sessionId: id },
        orderBy: { createdAt: 'asc' },
      })

      return apiSuccess(
        messages.map((m) => ({
          ...m,
          confidenceScore: m.confidenceScore
            ? Number(m.confidenceScore)
            : null,
        })),
      )
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
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    try {
      const { id } = await context.params
      const body: unknown = await req.json()
      const parsed = messageCreateSchema.safeParse(body)
      if (!parsed.success) {
        throw badRequest('입력값이 올바르지 않습니다.', {
          issues: parsed.error.issues,
        })
      }

      // Verify session ownership
      const session = await prisma.hrChatSession.findFirst({
        where: {
          id,
          employeeId: user.employeeId,
          companyId: user.companyId,
        },
      })
      if (!session) throw notFound('채팅 세션을 찾을 수 없습니다.')

      const { content } = parsed.data

      // 1. Save user message
      const userMessage = await prisma.hrChatMessage.create({
        data: {
          sessionId: id,
          role: 'USER',
          content,
        },
      })

      // 2. Generate embedding for the query
      let embedding: number[]
      try {
        embedding = await generateEmbedding(content)
      } catch {
        // Fallback: respond without RAG if embedding fails
        const fallbackResponse = await prisma.hrChatMessage.create({
          data: {
            sessionId: id,
            role: 'ASSISTANT',
            content:
              '죄송합니다. 현재 문서 검색 기능에 일시적인 문제가 있습니다. 잠시 후 다시 시도해주세요.',
            confidenceScore: 0,
          },
        })
        return apiSuccess({
          userMessage,
          assistantMessage: {
            ...fallbackResponse,
            confidenceScore: 0,
          },
        })
      }

      // 3. Vector search for relevant chunks
      const chunks = await searchSimilarChunks(
        embedding,
        user.companyId,
        5,
      )

      // 4. Build system prompt with context
      const contextText =
        chunks.length > 0
          ? chunks
              .map(
                (c, i) =>
                  `[출처 ${i + 1}: ${c.documentTitle} (유사도: ${(c.similarity * 100).toFixed(0)}%)]\n${c.content}`,
              )
              .join('\n\n')
          : '관련 문서를 찾을 수 없습니다.'

      const systemPrompt = `당신은 CTR HR Hub의 HR 챗봇 어시스턴트입니다.
직원의 HR 관련 질문에 회사 문서를 기반으로 정확하게 답변합니다.

규칙:
1. 제공된 문서 컨텍스트를 기반으로만 답변하세요.
2. 문서에 없는 내용은 "관련 정보를 찾을 수 없습니다"라고 솔직히 말하세요.
3. 답변 마지막에 [신뢰도: 0.XX] 형식으로 답변 신뢰도를 표시하세요 (0.0~1.0).
4. 한국어로 답변하세요.

─── 관련 문서 컨텍스트 ───
${contextText}`

      // 5. Call Claude
      const aiResult = await callClaude({
        feature: 'ANALYTICS_INSIGHT' as AiFeature,
        prompt: content,
        systemPrompt,
        maxTokens: 1024,
        companyId: user.companyId,
        employeeId: user.employeeId,
      })

      // 6. Parse confidence score from response
      const confidenceMatch = aiResult.content.match(
        /\[신뢰도:\s*([\d.]+)\]/,
      )
      const confidenceScore = confidenceMatch
        ? parseFloat(confidenceMatch[1])
        : 0.5
      const cleanContent = aiResult.content
        .replace(/\[신뢰도:\s*[\d.]+\]/, '')
        .trim()

      // 7. Build sources
      const sources = chunks
        .filter((c) => c.similarity > 0.3)
        .map((c) => ({
          title: c.documentTitle,
          reference: `${c.docType} (${(c.similarity * 100).toFixed(0)}%)`,
          chunkId: c.id,
        }))

      // 8. Save assistant message
      const assistantMessage = await prisma.hrChatMessage.create({
        data: {
          sessionId: id,
          role: 'ASSISTANT',
          content: cleanContent,
          sources: sources.length > 0 ? sources : undefined,
          confidenceScore,
        },
      })

      // Update session title if first message
      const messageCount = await prisma.hrChatMessage.count({
        where: { sessionId: id },
      })
      if (messageCount <= 2) {
        await prisma.hrChatSession.update({
          where: { id },
          data: {
            title: content.slice(0, 50) + (content.length > 50 ? '...' : ''),
          },
        })
      }

      return apiSuccess({
        userMessage,
        assistantMessage: {
          ...assistantMessage,
          confidenceScore: Number(assistantMessage.confidenceScore),
        },
        needsEscalation: confidenceScore < 0.7,
      })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.HR_CHATBOT, ACTION.CREATE),
)
