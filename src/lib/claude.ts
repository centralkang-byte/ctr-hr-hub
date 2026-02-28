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
  } catch (_error) {
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

// ─── Resume Analysis ─────────────────────────────────────

interface ResumeAnalysisInput {
  resumeText: string
  jobTitle: string
  requirements?: string
  preferred?: string
}

export interface ResumeAnalysisResult {
  overall_score: number
  fit_assessment: string
  strengths: string[]
  concerns: string[]
  experience_match: number
  skill_match: number
  culture_fit_indicators: string[]
  summary: string
}

export async function analyzeResume(
  input: ResumeAnalysisInput,
  companyId: string,
  employeeId: string,
): Promise<ResumeAnalysisResult> {
  const prompt = `당신은 CTR Holdings(자동차부품 글로벌 기업)의 채용 전문가입니다.
다음 이력서를 분석하여 채용 적합도를 평가하세요.

직무: ${input.jobTitle}
${input.requirements ? `자격 요건:\n${input.requirements}` : ''}
${input.preferred ? `우대 사항:\n${input.preferred}` : ''}

이력서 내용:
${input.resumeText}

아래 JSON 형식으로 응답하세요:
{
  "overall_score": 0-100 정수,
  "fit_assessment": "적합도 한줄 평가",
  "strengths": ["강점 1", "강점 2", "강점 3"],
  "concerns": ["우려사항 1", "우려사항 2"],
  "experience_match": 0-100 정수 (경험 매칭 점수),
  "skill_match": 0-100 정수 (기술 매칭 점수),
  "culture_fit_indicators": ["문화적합 지표 1", "문화적합 지표 2"],
  "summary": "종합 평가 2-3문장"
}

JSON만 응답하세요.`

  const result = await callClaude({
    feature: 'RESUME_ANALYSIS',
    prompt,
    systemPrompt: 'You are a recruitment specialist for CTR Holdings, a global automotive parts company. Respond in Korean with JSON only.',
    maxTokens: 1024,
    companyId,
    employeeId,
  })

  try {
    return JSON.parse(result.content) as ResumeAnalysisResult
  } catch {
    throw serviceUnavailable('AI 분석 결과 파싱에 실패했습니다.')
  }
}

// ─── Compensation Recommendation ─────────────────────────

interface CompensationRecommendationInput {
  employeeName: string
  department: string
  grade: string
  emsBlock: string | null
  compaRatio: number
  currentSalary: number
  currency: string
  tenureMonths: number
  budgetConstraint?: number
  companyAvgRaise?: number
}

export interface CompensationRecommendationResult {
  recommendedPct: number
  reasoning: string
  riskFactors: string[]
  alternativeActions: string[]
}

export async function compensationRecommendation(
  input: CompensationRecommendationInput,
  companyId: string,
  employeeId: string,
): Promise<CompensationRecommendationResult> {
  const prompt = `당신은 CTR Holdings(자동차부품 글로벌 기업)의 보상 전문가입니다.
다음 직원의 연봉 인상률을 추천하세요:

직원명: ${input.employeeName}
부서: ${input.department}
직급: ${input.grade}
EMS 블록: ${input.emsBlock ?? '미평가'}
Compa-Ratio: ${input.compaRatio.toFixed(2)}
현재 연봉: ${input.currentSalary.toLocaleString()} ${input.currency}
재직 기간: ${input.tenureMonths}개월
${input.budgetConstraint ? `예산 제약: ${input.budgetConstraint}%` : ''}
${input.companyAvgRaise ? `회사 평균 인상률: ${input.companyAvgRaise}%` : ''}

Compa-Ratio 해석:
- 0.80 미만: 심각한 저보상
- 0.80-0.90: 낮은 보상
- 0.90-1.00: 시장 수준 이하
- 1.00-1.10: 적정 수준
- 1.10 초과: 시장 이상

EMS 블록 해석 (1-9):
- 7-9: 고성과 (인재 유지 중요)
- 4-6: 중간 성과
- 1-3: 개선 필요

아래 JSON 형식으로 응답하세요:
{
  "recommendedPct": 인상률(소수점 1자리),
  "reasoning": "추천 근거 설명 (2-3문장)",
  "riskFactors": ["위험 요인 1", "위험 요인 2"],
  "alternativeActions": ["대안 1", "대안 2"]
}

JSON만 응답하세요.`

  const result = await callClaude({
    feature: 'COMPENSATION_RECOMMENDATION',
    prompt,
    systemPrompt: 'You are a compensation specialist for CTR Holdings, a global automotive parts company. Respond in Korean with JSON only.',
    maxTokens: 1024,
    companyId,
    employeeId,
  })

  try {
    return JSON.parse(result.content) as CompensationRecommendationResult
  } catch {
    throw serviceUnavailable('AI 분석 결과 파싱에 실패했습니다.')
  }
}

// ─── Attrition Risk Assessment ───────────────────────────

interface AttritionRiskAssessmentInput {
  employeeName: string
  department: string
  grade: string
  tenureMonths: number
  factorScores: Record<string, number>
  totalScore: number
  compaRatio: number
  emsBlock: string | null
}

export interface AttritionRiskAssessmentResult {
  adjusted_score: number
  adjusted_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  risk_drivers: string[]
  contextual_risks: string[]
  retention_actions: string[]
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
}

export async function attritionRiskAssessment(
  input: AttritionRiskAssessmentInput,
  companyId: string,
  employeeId: string,
): Promise<AttritionRiskAssessmentResult> {
  const factorLines = Object.entries(input.factorScores)
    .map(([key, val]) => `- ${key}: ${val}/100`)
    .join('\n')

  const prompt = `당신은 CTR Holdings의 인재 유지 전문가입니다.
다음 직원의 이탈 위험을 AI 관점에서 재평가하세요:

직원명: ${input.employeeName}
부서: ${input.department}
직급: ${input.grade}
재직 기간: ${input.tenureMonths}개월
Compa-Ratio: ${input.compaRatio.toFixed(2)}
EMS 블록: ${input.emsBlock ?? '미평가'}

6요인 위험 점수 (0-100, 높을수록 위험):
${factorLines}

규칙 기반 총점: ${input.totalScore}/100

위 데이터를 종합적으로 분석하여, 규칙 기반 점수를 보정하고 맥락적 위험 요소와 리텐션 조치를 제안하세요.

아래 JSON 형식으로 응답하세요:
{
  "adjusted_score": 보정된 점수(0-100 정수),
  "adjusted_level": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "risk_drivers": ["핵심 이탈 동인 1", "핵심 이탈 동인 2"],
  "contextual_risks": ["맥락적 위험 1", "맥락적 위험 2"],
  "retention_actions": ["리텐션 액션 1", "리텐션 액션 2", "리텐션 액션 3"],
  "confidence": "HIGH" | "MEDIUM" | "LOW"
}

JSON만 응답하세요.`

  const result = await callClaude({
    feature: 'ATTRITION_RISK_ASSESSMENT',
    prompt,
    systemPrompt: 'You are a talent retention specialist for CTR Holdings, a global automotive parts company. Respond in Korean with JSON only.',
    maxTokens: 1024,
    companyId,
    employeeId,
  })

  try {
    return JSON.parse(result.content) as AttritionRiskAssessmentResult
  } catch {
    throw serviceUnavailable('AI 분석 결과 파싱에 실패했습니다.')
  }
}
