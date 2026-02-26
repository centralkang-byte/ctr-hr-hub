// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Claude AI Client
// 모든 Claude API 호출은 이 파일을 통해서만
// ═══════════════════════════════════════════════════════════

import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { serviceUnavailable } from '@/lib/errors'
import type { AiFeature } from '@/types'

// ─── Anthropic Client Singleton ──────────────────────────

const globalForAnthropic = globalThis as unknown as {
  __anthropic: Anthropic | undefined
}

function getAnthropicClient(): Anthropic {
  if (!globalForAnthropic.__anthropic) {
    if (!env.ANTHROPIC_API_KEY) {
      throw serviceUnavailable('AI 서비스가 설정되지 않았습니다.')
    }
    globalForAnthropic.__anthropic = new Anthropic({
      apiKey: env.ANTHROPIC_API_KEY,
    })
  }
  return globalForAnthropic.__anthropic
}

// ─── Types ───────────────────────────────────────────────

interface CallClaudeInput {
  feature: AiFeature
  prompt: string
  systemPrompt?: string
  maxTokens?: number
  companyId?: string
  employeeId?: string
}

interface CallClaudeResult {
  content: string
  inputTokens: number
  outputTokens: number
  latencyMs: number
}

const AI_MODEL = 'claude-sonnet-4-20250514'

// ─── Call Claude ─────────────────────────────────────────

export async function callClaude(
  input: CallClaudeInput,
): Promise<CallClaudeResult> {
  const client = getAnthropicClient()
  const startTime = Date.now()

  try {
    const response = await client.messages.create({
      model: AI_MODEL,
      max_tokens: input.maxTokens ?? 2048,
      system: input.systemPrompt ?? 'You are an HR assistant for CTR Holdings.',
      messages: [{ role: 'user', content: input.prompt }],
    })

    const latencyMs = Date.now() - startTime

    const textContent = response.content.find((block) => block.type === 'text')
    const content =
      textContent && 'text' in textContent ? textContent.text : ''

    const result: CallClaudeResult = {
      content,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      latencyMs,
    }

    // Log AI call (fire-and-forget)
    if (input.companyId) {
      logAiCall({
        feature: input.feature,
        model: AI_MODEL,
        promptVersion: '1.0',
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        latencyMs: result.latencyMs,
        companyId: input.companyId,
        employeeId: input.employeeId,
      })
    }

    return result
  } catch (error) {
    const latencyMs = Date.now() - startTime

    if (input.companyId) {
      logAiCall({
        feature: input.feature,
        model: AI_MODEL,
        promptVersion: '1.0',
        inputTokens: 0,
        outputTokens: 0,
        latencyMs,
        companyId: input.companyId,
        employeeId: input.employeeId,
      })
    }

    throw serviceUnavailable('AI 서비스를 일시적으로 사용할 수 없습니다.')
  }
}

// ─── Log AI Call ─────────────────────────────────────────

interface AiLogInput {
  feature: AiFeature
  model: string
  promptVersion: string
  inputTokens: number
  outputTokens: number
  latencyMs: number
  companyId: string
  employeeId?: string
}

function logAiCall(input: AiLogInput): void {
  prisma.aiLog
    .create({
      data: {
        feature: input.feature,
        model: input.model,
        promptVersion: input.promptVersion,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        latencyMs: input.latencyMs,
        companyId: input.companyId,
        employeeId: input.employeeId ?? null,
      },
    })
    .catch(() => {
      // AI logging should not break business logic
    })
}
