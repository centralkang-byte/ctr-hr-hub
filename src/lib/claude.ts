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

// ─── Onboarding Checkin Summary ──────────────────────────

interface CheckinData {
  week: number
  mood: string
  energy: number
  belonging: number
  comment: string | null
}

interface OnboardingCheckinSummaryResult {
  overall_sentiment: 'POSITIVE' | 'MIXED' | 'CONCERNING'
  trend: 'IMPROVING' | 'STABLE' | 'DECLINING'
  key_observations: string[]
  recommended_actions: string[]
}

export async function onboardingCheckinSummary(
  employeeName: string,
  checkins: CheckinData[],
  companyId: string,
  employeeId: string,
): Promise<OnboardingCheckinSummaryResult> {
  const prompt = `다음은 ${employeeName} 신입사원의 온보딩 체크인 데이터입니다:

${checkins
  .map(
    (c) =>
      `${c.week}주차: mood=${c.mood}, energy=${c.energy}/5, belonging=${c.belonging}/5${c.comment ? `, comment="${c.comment}"` : ''}`,
  )
  .join('\n')}

위 데이터를 분석하여 아래 JSON 형식으로 응답하세요:
{
  "overall_sentiment": "POSITIVE" | "MIXED" | "CONCERNING",
  "trend": "IMPROVING" | "STABLE" | "DECLINING",
  "key_observations": ["관찰 사항 1", "관찰 사항 2"],
  "recommended_actions": ["권장 조치 1", "권장 조치 2"]
}

JSON만 응답하세요.`

  const result = await callClaude({
    feature: 'ONBOARDING_CHECKIN_SUMMARY',
    prompt,
    maxTokens: 1024,
    companyId,
    employeeId,
  })

  try {
    return JSON.parse(result.content) as OnboardingCheckinSummaryResult
  } catch {
    throw serviceUnavailable('AI 분석 결과 파싱에 실패했습니다.')
  }
}

// ─── Job Description Generation ──────────────────────────

interface JobDescriptionInput {
  title: string
  department?: string
  grade?: string
  category?: string
  requirements?: string
}

interface JobDescriptionResult {
  description: string
  qualifications: string
  preferred: string
}

export async function generateJobDescription(
  input: JobDescriptionInput,
  companyId: string,
  employeeId: string,
): Promise<JobDescriptionResult> {
  const prompt = `당신은 CTR Holdings(자동차부품 글로벌 기업)의 채용 담당자입니다.
다음 정보를 바탕으로 채용 공고 초안을 작성하세요:

직무명: ${input.title}
${input.department ? `부서: ${input.department}` : ''}
${input.grade ? `직급: ${input.grade}` : ''}
${input.category ? `직군: ${input.category}` : ''}
${input.requirements ? `요구사항 키워드: ${input.requirements}` : ''}

아래 JSON 형식으로 응답하세요:
{
  "description": "직무 설명 (3-5문장)",
  "qualifications": "자격 요건 (bullet point 형태, \\n 구분)",
  "preferred": "우대 사항 (bullet point 형태, \\n 구분)"
}

JSON만 응답하세요.`

  const result = await callClaude({
    feature: 'JOB_DESCRIPTION_GENERATION',
    prompt,
    systemPrompt: 'You are an HR specialist for CTR Holdings, a global automotive parts company. Respond in Korean.',
    maxTokens: 1024,
    companyId,
    employeeId,
  })

  try {
    return JSON.parse(result.content) as JobDescriptionResult
  } catch {
    throw serviceUnavailable('AI 분석 결과 파싱에 실패했습니다.')
  }
}

// ─── Exit Interview Summary ───────────────────────────────

interface ExitInterviewSummaryResult {
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'
  key_issues: string[]
  retention_insight: string
  action_needed: string | null
}

export async function exitInterviewSummary(
  employeeName: string,
  tenureMonths: number,
  resignType: string,
  primaryReason: string,
  satisfactionScore: number,
  feedbackText: string,
  companyId: string,
  employeeId: string,
): Promise<ExitInterviewSummaryResult> {
  const prompt = `다음은 ${employeeName}(재직 ${tenureMonths}개월)의 퇴직 면담 정보입니다:
퇴직 유형: ${resignType}
주요 퇴사 사유: ${primaryReason}
만족도: ${satisfactionScore}/5
의견: "${feedbackText}"

위 내용을 분석하여 아래 JSON 형식으로 응답하세요:
{
  "sentiment": "POSITIVE" | "NEUTRAL" | "NEGATIVE",
  "key_issues": ["핵심 이슈 1", "핵심 이슈 2"],
  "retention_insight": "이 직원을 유지할 수 있었던 방법에 대한 인사이트",
  "action_needed": "필요한 조직 개선 행동 또는 null"
}

JSON만 응답하세요.`

  const result = await callClaude({
    feature: 'EXIT_INTERVIEW_SUMMARY',
    prompt,
    maxTokens: 1024,
    companyId,
    employeeId,
  })

  try {
    return JSON.parse(result.content) as ExitInterviewSummaryResult
  } catch {
    throw serviceUnavailable('AI 분석 결과 파싱에 실패했습니다.')
  }
}
