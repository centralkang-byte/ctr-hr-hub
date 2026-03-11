// ═══════════════════════════════════════════════════════════
// G-2: AI Report Generator
// Calls Anthropic Claude API with CHRO system prompt
// Deep Link ROUTE_MAP included in prompt
// 🚨 Requires ANTHROPIC_API_KEY env var
// ═══════════════════════════════════════════════════════════

import type { ReportDataPayload } from './data-collector'

const ROUTE_MAP = {
  teamHealth: '/analytics/team-health',
  turnover: '/analytics/turnover',
  payroll: '/analytics/payroll',
  performance: '/analytics/performance',
  attendance: '/analytics/attendance',
  workforce: '/analytics/workforce',
  leaveAdmin: '/leave/admin',
  executive: '/analytics',
}

const SYSTEM_PROMPT = `당신은 CTR 그룹의 CHRO(최고인사책임자) 어시스턴트입니다.
매월 HR 현황을 분석하여 경영진과 HR팀에게 보고하는 월간 리포트를 작성합니다.

## 리포트 형식
마크다운으로 작성하며, 다음 3개 섹션으로 구성합니다:

### 📊 주요 변동
- 인원, 이직률, 인건비 등 핵심 KPI의 전월 대비 변동
- 숫자와 비율을 구체적으로 기재

### ⚠️ 위험 신호
- 이직 예측 고위험자 수, 번아웃 위험자 수
- 52h 위반, 부서별 이상 징후
- 심각도 순서로 정렬

### 💡 추천 액션
- 각 위험 신호에 대한 구체적인 조치 권고
- 반드시 시스템 내 해당 화면으로 이동하는 링크를 포함
- 링크 형식: [액션 텍스트](URL)

## 사용 가능한 시스템 링크
${JSON.stringify(ROUTE_MAP, null, 2)}

## 주의사항
- 개인 이름은 절대 언급하지 마세요 (집계 데이터만 사용)
- 한국어로 작성하세요
- 간결하고 실행 가능한(Actionable) 내용에 집중하세요
- Deep Link는 마크다운 링크 형식으로: [텍스트](/경로?파라미터)
- 데이터가 0인 항목은 "해당 없음" 또는 생략하세요`

/**
 * Generate AI report using Anthropic Claude API.
 * Falls back to template-based report if API key not configured.
 */
export async function generateAiReport(data: ReportDataPayload): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY

  // If Anthropic API key is available, use Claude
  if (apiKey) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          system: SYSTEM_PROMPT,
          messages: [{
            role: 'user',
            content: `아래는 ${data.companyName}의 ${data.period} HR 현황 데이터입니다. 월간 리포트를 작성해주세요.\n\n${JSON.stringify(data, null, 2)}`,
          }],
        }),
      })

      if (response.ok) {
        const result = await response.json()
        const content = result.content?.[0]
        if (content?.type === 'text') {
          return content.text
        }
      }
      // Fall through to template if API fails
      console.warn('[AI Report] Anthropic API call failed, using template fallback')
    } catch (err) {
      console.warn('[AI Report] Anthropic API error:', err)
    }
  }

  // Template fallback — structured report without AI
  return generateTemplateReport(data)
}

/**
 * Template-based report when Anthropic API is unavailable.
 * Produces structured markdown with deep links.
 */
function generateTemplateReport(data: ReportDataPayload): string {
  const { headcount, turnover, payroll, performance, attendance, onboarding, predictions } = data

  const sections: string[] = []

  // Header
  sections.push(`# ${data.companyName} — ${data.period} 월간 HR 리포트\n`)

  // Section 1: 주요 변동
  sections.push(`## 📊 주요 변동\n`)
  sections.push(`| KPI | 수치 | 변동 |`)
  sections.push(`|-----|------|------|`)
  sections.push(`| 재직 인원 | **${headcount.total}명** | 입사 ${headcount.newHires}명, 퇴사 ${headcount.exits}명 (순증 ${headcount.netChange >= 0 ? '+' : ''}${headcount.netChange}명) |`)
  sections.push(`| 월간 이직률 | **${turnover.monthlyRate}%** | 전월 ${turnover.prevMonthlyRate}% → ${turnover.monthlyRate > turnover.prevMonthlyRate ? '📈 상승' : turnover.monthlyRate < turnover.prevMonthlyRate ? '📉 하락' : '➡️ 동일'} |`)
  sections.push(`| 월 인건비 | **${payroll.formattedTotal}** | 전월 대비 ${payroll.changeRate >= 0 ? '+' : ''}${payroll.changeRate}% |`)
  sections.push(`| 1인당 인건비 | **${formatCompact(payroll.perCapita)}** | - |`)
  sections.push(`| 연차 사용률 | **${attendance.leaveUsageRate}%** | - |`)
  sections.push('')

  if (turnover.topExitReasons.length > 0) {
    sections.push(`**주요 퇴직 사유:** ${turnover.topExitReasons.map((r) => `${r.reason}(${r.count}건)`).join(', ')}\n`)
  }

  // Section 2: 위험 신호
  sections.push(`## ⚠️ 위험 신호\n`)
  const risks: string[] = []

  if (predictions.turnoverHighRisk > 0) {
    risks.push(`- 🔴 **이직 예측 고위험** ${predictions.turnoverHighRisk}명 — [이직 분석 대시보드 확인](${ROUTE_MAP.turnover})`)
  }
  if (predictions.burnoutAtRisk > 0) {
    risks.push(`- 🟠 **번아웃 위험** ${predictions.burnoutAtRisk}명 — [팀 건강 대시보드 확인](${ROUTE_MAP.teamHealth})`)
  }
  if (attendance.weeklyOvertimeViolations > 0) {
    risks.push(`- 🟡 **초과근무 다발** ${attendance.weeklyOvertimeViolations}건 — [근태 분석 확인](${ROUTE_MAP.attendance})`)
  }
  if (turnover.regrettableExits > 0) {
    risks.push(`- 🔴 **핵심 인재 이직** ${turnover.regrettableExits}명 (E/M+ 등급) — [이직 분석 확인](${ROUTE_MAP.turnover})`)
  }
  if (turnover.monthlyRate > 5) {
    risks.push(`- 🔴 **높은 이직률** ${turnover.monthlyRate}% (업계 평균 4.5%) — [인력 분석 확인](${ROUTE_MAP.workforce})`)
  }

  if (risks.length === 0) {
    sections.push(`✅ 현재 특이 위험 신호가 없습니다.\n`)
  } else {
    sections.push(risks.join('\n'))
    sections.push('')
  }

  // Section 3: 추천 액션
  sections.push(`## 💡 추천 액션\n`)
  const actions: string[] = []

  if (predictions.turnoverHighRisk > 0) {
    actions.push(`1. **이직 고위험 직원 면담** — ${predictions.turnoverHighRisk}명에 대한 리텐션 면담을 진행하세요. → [이직 분석](${ROUTE_MAP.turnover})`)
  }
  if (attendance.weeklyOvertimeViolations > 0) {
    actions.push(`${actions.length + 1}. **초과근무 집중 부서 업무 재배분** — 근로기준법 위반 위험 사전 조치 → [근태/휴가 분석](${ROUTE_MAP.attendance})`)
  }
  if (attendance.leaveUsageRate < 40) {
    actions.push(`${actions.length + 1}. **연차 사용 촉진** — 전사 사용률 ${attendance.leaveUsageRate}%로 저조합니다. 관리자 알림을 발송하세요 → [휴가 관리](${ROUTE_MAP.leaveAdmin})`)
  }
  if (onboarding.inProgress > 0) {
    actions.push(`${actions.length + 1}. **온보딩 진행 현황 점검** — 현재 ${onboarding.inProgress}명 온보딩 진행 중, ${onboarding.completedThisMonth}명 완료`)
  }
  if (performance.currentPhase && performance.currentPhase !== '-') {
    actions.push(`${actions.length + 1}. **성과 관리 사이클 확인** — 현재 단계: ${performance.currentPhase} → [성과 분석](${ROUTE_MAP.performance})`)
  }

  if (actions.length === 0) {
    actions.push('1. 모든 지표가 정상 범위입니다. 다음 달 리포트에서 추이를 확인하세요.')
  }
  sections.push(actions.join('\n'))
  sections.push('')

  // Footer
  sections.push(`---\n*이 리포트는 ${new Date().toISOString().slice(0, 10)}에 자동 생성되었습니다.*`)

  return sections.join('\n')
}

function formatCompact(amount: number): string {
  if (amount >= 1_000_000) return `₩${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `₩${(amount / 1_000).toFixed(0)}K`
  return `₩${amount.toLocaleString()}`
}
