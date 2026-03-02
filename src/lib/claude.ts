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

// ─── Eval Comment Suggestion ────────────────────────────

interface EvalCommentInput {
  employeeName: string
  goalSummary: string
  goalScores: { title: string; score: number; weight: number }[]
  competencyScores: { name: string; score: number }[]
  evalType: 'SELF' | 'MANAGER'
}

export interface EvalCommentSuggestionResult {
  suggested_comment: string
  strengths: string[]
  improvement_areas: string[]
  development_suggestions: string[]
}

export async function suggestEvalComment(
  input: EvalCommentInput,
  companyId: string,
  employeeId: string,
): Promise<EvalCommentSuggestionResult> {
  const goalLines = input.goalScores
    .map((g) => `- ${g.title} (가중치 ${g.weight}%): ${g.score}/5점`)
    .join('\n')
  const compLines = input.competencyScores
    .map((c) => `- ${c.name}: ${c.score}/5점`)
    .join('\n')

  const evalTypeLabel = input.evalType === 'SELF' ? '자기평가' : '매니저 평가'

  const prompt = `당신은 CTR Holdings의 성과관리 전문가입니다.
다음은 ${input.employeeName}에 대한 ${evalTypeLabel} 데이터입니다:

목표 요약: ${input.goalSummary}

목표별 점수:
${goalLines}

역량별 점수:
${compLines}

위 데이터를 바탕으로 ${evalTypeLabel} 종합 코멘트 초안을 작성하세요.
아래 JSON 형식으로 응답하세요:
{
  "suggested_comment": "종합 평가 코멘트 (3-5문장)",
  "strengths": ["강점 1", "강점 2"],
  "improvement_areas": ["개선영역 1", "개선영역 2"],
  "development_suggestions": ["육성 제안 1", "육성 제안 2"]
}

JSON만 응답하세요.`

  const result = await callClaude({
    feature: 'EVAL_COMMENT_SUGGESTION',
    prompt,
    systemPrompt: 'You are an HR performance management specialist for CTR Holdings. Respond in Korean with JSON only.',
    maxTokens: 1024,
    companyId,
    employeeId,
  })

  try {
    return JSON.parse(result.content) as EvalCommentSuggestionResult
  } catch {
    throw serviceUnavailable('AI 분석 결과 파싱에 실패했습니다.')
  }
}

// ─── Calibration Analysis ───────────────────────────────

interface CalibrationAnalysisInput {
  sessionName: string
  departmentName?: string
  evaluations: {
    employeeName: string
    performanceScore: number
    competencyScore: number
    emsBlock: string
    selfScore?: number
    managerScore?: number
  }[]
  blockDistribution: Record<string, number>
}

export interface CalibrationAnalysisResult {
  overall_assessment: string
  distribution_analysis: string
  outliers: { employeeName: string; reason: string; suggestion: string }[]
  bias_indicators: string[]
  recommendations: string[]
}

export async function calibrationAnalysis(
  input: CalibrationAnalysisInput,
  companyId: string,
  employeeId: string,
): Promise<CalibrationAnalysisResult> {
  const evalLines = input.evaluations
    .map(
      (e) =>
        `- ${e.employeeName}: 성과=${e.performanceScore.toFixed(1)}, 역량=${e.competencyScore.toFixed(1)}, 블록=${e.emsBlock}${e.selfScore != null ? `, 자기평가=${e.selfScore.toFixed(1)}` : ''}${e.managerScore != null ? `, 매니저평가=${e.managerScore.toFixed(1)}` : ''}`,
    )
    .join('\n')

  const distLines = Object.entries(input.blockDistribution)
    .map(([block, count]) => `- ${block}: ${count}명`)
    .join('\n')

  const prompt = `당신은 CTR Holdings의 성과 캘리브레이션 전문가입니다.
다음은 "${input.sessionName}"${input.departmentName ? ` (${input.departmentName})` : ''} 캘리브레이션 세션 데이터입니다:

평가 결과:
${evalLines}

블록 분포:
${distLines}

위 데이터를 분석하여 캘리브레이션 인사이트를 제공하세요.
아래 JSON 형식으로 응답하세요:
{
  "overall_assessment": "전체 평가 분포 분석 (2-3문장)",
  "distribution_analysis": "정규분포 대비 편향 분석 (2-3문장)",
  "outliers": [{"employeeName": "이름", "reason": "이상값 사유", "suggestion": "조정 제안"}],
  "bias_indicators": ["편향 지표 1", "편향 지표 2"],
  "recommendations": ["캘리브레이션 권고 1", "캘리브레이션 권고 2"]
}

JSON만 응답하세요.`

  const result = await callClaude({
    feature: 'CALIBRATION_ANALYSIS',
    prompt,
    systemPrompt: 'You are a performance calibration specialist for CTR Holdings. Respond in Korean with JSON only.',
    maxTokens: 2048,
    companyId,
    employeeId,
  })

  try {
    return JSON.parse(result.content) as CalibrationAnalysisResult
  } catch {
    throw serviceUnavailable('AI 분석 결과 파싱에 실패했습니다.')
  }
}

// ─── Generate One-on-One Notes ─────────────────────────

export interface OneOnOneNotesInput {
  employeeName: string
  meetingType: string
  previousActionItems: { item: string; status: string }[]
  currentNotes: string
  employeeGoals: { title: string; achievementRate: number }[]
}

export interface OneOnOneNotesResult {
  structured_notes: string
  follow_up_items: string[]
  coaching_tip: string
}

export async function generateOneOnOneNotes(
  input: OneOnOneNotesInput,
  companyId: string,
  employeeId: string,
): Promise<OneOnOneNotesResult> {
  const actionItemLines = input.previousActionItems.length > 0
    ? input.previousActionItems.map((a) => `- ${a.item} (${a.status})`).join('\n')
    : '- 없음'

  const goalLines = input.employeeGoals.length > 0
    ? input.employeeGoals.map((g) => `- ${g.title}: 달성률 ${g.achievementRate}%`).join('\n')
    : '- 목표 없음'

  const prompt = `당신은 CTR Holdings의 매니저 코칭 전문가입니다.
다음은 ${input.employeeName}과의 1:1 미팅 (유형: ${input.meetingType}) 정보입니다:

이전 액션 아이템:
${actionItemLines}

현재 미팅 노트:
${input.currentNotes || '(작성된 노트 없음)'}

직원 목표 진행 현황:
${goalLines}

위 정보를 바탕으로 1:1 미팅 노트를 정리하고 후속 조치를 제안하세요.
아래 JSON 형식으로 응답하세요:
{
  "structured_notes": "구조화된 미팅 노트 (마크다운 형식, 주요 논의사항/결정사항/우려사항 구분)",
  "follow_up_items": ["후속 액션 아이템 1", "후속 액션 아이템 2"],
  "coaching_tip": "매니저를 위한 코칭 팁 (1-2문장)"
}

JSON만 응답하세요.`

  const result = await callClaude({
    feature: 'ONE_ON_ONE_NOTES',
    prompt,
    systemPrompt: 'You are a coaching specialist for CTR Holdings. Respond in Korean with JSON only.',
    maxTokens: 1536,
    companyId,
    employeeId,
  })

  try {
    return JSON.parse(result.content) as OneOnOneNotesResult
  } catch {
    throw serviceUnavailable('AI 미팅 노트 생성에 실패했습니다.')
  }
}

// ─── Pulse Survey Analysis ──────────────────────────────

export interface PulseAnalysisInput {
  surveyTitle: string
  questionResults: {
    questionText: string
    questionType: string
    average?: number
    distribution?: Record<string, number>
    answers?: string[]
    responseCount: number
  }[]
  totalRespondents: number
  departmentBreakdown?: Record<string, Record<string, number>>
}

export interface PulseAnalysisResult {
  overall_sentiment: string
  key_insights: string[]
  risk_areas: string[]
  recommendations: string[]
  department_comparison?: string
}

export async function pulseSurveyAnalysis(
  input: PulseAnalysisInput,
  companyId: string,
  employeeId: string,
): Promise<PulseAnalysisResult> {
  const questionSummaries = input.questionResults.map((q) => {
    if (q.questionType === 'LIKERT') {
      return `- "${q.questionText}" → 평균: ${q.average}/5 (${q.responseCount}명 응답), 분포: ${JSON.stringify(q.distribution)}`
    }
    if (q.questionType === 'CHOICE') {
      return `- "${q.questionText}" → 분포: ${JSON.stringify(q.distribution)} (${q.responseCount}명 응답)`
    }
    const sampleAnswers = (q.answers ?? []).slice(0, 5).join('; ')
    return `- "${q.questionText}" → 주요 응답: ${sampleAnswers} (${q.responseCount}명 응답)`
  }).join('\n')

  const prompt = `당신은 CTR Holdings의 조직문화 분석 전문가입니다.
다음은 펄스 서베이 "${input.surveyTitle}" 결과입니다 (총 ${input.totalRespondents}명 응답):

${questionSummaries}

${input.departmentBreakdown ? `부서별 LIKERT 평균:\n${JSON.stringify(input.departmentBreakdown, null, 2)}` : ''}

위 결과를 분석하여 아래 JSON 형식으로 응답하세요:
{
  "overall_sentiment": "전체적인 조직 분위기 요약 (2-3문장)",
  "key_insights": ["핵심 인사이트 1", "핵심 인사이트 2", "핵심 인사이트 3"],
  "risk_areas": ["주의가 필요한 영역 1", "주의가 필요한 영역 2"],
  "recommendations": ["개선 제안 1", "개선 제안 2", "개선 제안 3"],
  "department_comparison": "부서간 차이 분석 (해당시)"
}

JSON만 응답하세요.`

  const result = await callClaude({
    feature: 'PULSE_ANALYSIS',
    prompt,
    systemPrompt: 'You are an organizational culture analyst for CTR Holdings. Respond in Korean with JSON only.',
    maxTokens: 1536,
    companyId,
    employeeId,
  })

  try {
    return JSON.parse(result.content) as PulseAnalysisResult
  } catch {
    throw serviceUnavailable('AI 펄스 서베이 분석에 실패했습니다.')
  }
}

// ─── Peer Review Summary ────────────────────────────────

export interface PeerReviewSummaryInput {
  employeeName: string
  reviewerCount: number
  averageScore: number
  competencyAvg: Record<string, number>
  comments: string[]
}

export interface PeerReviewSummaryResult {
  summary: string
  strengths: string[]
  development_areas: string[]
  coaching_suggestion: string
}

export async function generatePeerReviewSummary(
  input: PeerReviewSummaryInput,
  companyId: string,
  employeeId: string,
): Promise<PeerReviewSummaryResult> {
  const competencyLines = Object.entries(input.competencyAvg)
    .map(([key, val]) => `- ${key}: ${val}/5`)
    .join('\n')

  const commentLines = input.comments
    .map((c, i) => `리뷰어 ${i + 1}: "${c}"`)
    .join('\n')

  const prompt = `당신은 CTR Holdings의 360도 피드백 분석 전문가입니다.
다음은 ${input.employeeName}의 동료 평가 결과입니다:

평가자 수: ${input.reviewerCount}명
종합 점수: ${input.averageScore}/5

역량별 평균:
${competencyLines}

동료 코멘트:
${commentLines}

위 결과를 종합하여 아래 JSON 형식으로 응답하세요:
{
  "summary": "종합 피드백 요약 (3-4문장)",
  "strengths": ["강점 1", "강점 2"],
  "development_areas": ["개발 영역 1", "개발 영역 2"],
  "coaching_suggestion": "매니저를 위한 코칭 제안 (2-3문장)"
}

JSON만 응답하세요.`

  const result = await callClaude({
    feature: 'PEER_REVIEW_SUMMARY',
    prompt,
    systemPrompt: 'You are a 360-degree feedback analyst for CTR Holdings. Respond in Korean with JSON only.',
    maxTokens: 1024,
    companyId,
    employeeId,
  })

  try {
    return JSON.parse(result.content) as PeerReviewSummaryResult
  } catch {
    throw serviceUnavailable('AI 동료 평가 요약 생성에 실패했습니다.')
  }
}
