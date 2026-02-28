// ═══════════════════════════════════════════════════════════
// CTR HR Hub — AI Executive Report Generator
// MV 데이터를 수집하여 Claude로 경영진 보고서 생성
// ═══════════════════════════════════════════════════════════

import { callClaude } from '@/lib/claude'
import type { SessionUser } from '@/types'
import type { ExecutiveReport } from './types'
import {
  getHeadcountSummary,
  getHeadcountByDepartment,
  getBurnoutRiskCount,
  getAvgOvertimeHours,
  getMonthlyResignations,
  getExitReasonSummary,
  getEmsBlockDistribution,
  getPerformanceByDepartment,
  getRecruitmentFunnel,
  getCompaRatioByGrade,
  getCompaBandFit,
  getTeamHealthList,
} from './queries'

export async function generateExecutiveReport(
  companyId: string | undefined,
  user: SessionUser,
): Promise<ExecutiveReport> {
  // 1. Collect all MV data in parallel
  const [
    headcount,
    headcountByDept,
    burnoutCount,
    avgOvertime,
    monthlyResignations,
    exitReasons,
    emsDistribution,
    perfByDept,
    recruitmentFunnel,
    compaByGrade,
    bandFit,
    teamHealth,
  ] = await Promise.all([
    getHeadcountSummary(companyId),
    getHeadcountByDepartment(companyId),
    getBurnoutRiskCount(companyId),
    getAvgOvertimeHours(companyId),
    getMonthlyResignations(companyId, 6),
    getExitReasonSummary(companyId, 6),
    getEmsBlockDistribution(undefined, companyId),
    getPerformanceByDepartment(undefined, companyId),
    getRecruitmentFunnel(companyId),
    getCompaRatioByGrade(companyId),
    getCompaBandFit(companyId),
    getTeamHealthList(companyId),
  ])

  // 2. Build data summary for prompt
  const hc = headcount[0]
  const dataSummary = `
## 인력 현황
- 총 인원: ${Number(hc?.total_headcount ?? 0)}명
- 최근 30일 신규 입사: ${Number(hc?.new_hires_30d ?? 0)}명
- 최근 30일 퇴사: ${Number(hc?.resignations_30d ?? 0)}명

## 부서별 인원
${headcountByDept.map((d) => `- ${d.department_name}: ${Number(d.headcount)}명`).join('\n')}

## 번아웃 위험
- 번아웃 위험 인원: ${Number(burnoutCount[0]?.count ?? 0)}명

## 근태
- 최근 4주 평균 초과근무: ${avgOvertime[0]?.avg_overtime_hours ?? 0}시간

## 월별 퇴사 추이 (최근 6개월)
${monthlyResignations.map((r) => `- ${new Date(r.month).toISOString().slice(0, 7)}: ${Number(r.resignations)}명`).join('\n')}

## 퇴사 사유
${exitReasons.map((r) => `- ${r.primary_reason}: ${Number(r.count)}건`).join('\n')}

## 성과 분석 (EMS 9-block 분포)
${emsDistribution.map((r) => `- Block ${r.ems_block}: ${Number(r.employee_count)}명`).join('\n')}

## 부서별 성과 점수
${perfByDept.map((r) => `- ${r.department_name}: ${r.avg_score}점`).join('\n')}

## 채용 현황
${recruitmentFunnel.map((r) => `- ${r.stage}: ${Number(r.candidate_count)}명`).join('\n')}

## 보상 분석 (직급별 Compa-Ratio)
${compaByGrade.map((r) => `- ${r.grade_name}: ${r.avg_compa_ratio}`).join('\n')}

## 급여 밴드 적합도
- Under Band: ${Number(bandFit[0]?.under ?? 0)}명
- In Band: ${Number(bandFit[0]?.in_band ?? 0)}명
- Over Band: ${Number(bandFit[0]?.over ?? 0)}명

## 팀 건강 지표
${teamHealth.map((t) => `- ${t.department_name}: 성과 ${t.avg_performance_score ?? '-'}, 1:1 커버리지 ${t.one_on_one_coverage_pct ?? 0}%`).join('\n')}
`.trim()

  // 3. Call Claude
  const result = await callClaude({
    feature: 'EXECUTIVE_REPORT',
    systemPrompt: `당신은 CTR Holdings(글로벌 자동차부품 제조사)의 HR 전략 컨설턴트입니다.
제공된 HR 데이터를 분석하여 경영진을 위한 한국어 보고서를 마크다운 형식으로 작성하세요.

보고서 구조:
1. **요약** — 핵심 지표 3-4개 요약
2. **인력 현황** — 인원수, 입퇴사 트렌드
3. **이직 동향** — 이직률, 주요 사유, 위험 부서
4. **성과 분석** — 성과 분포, 부서간 비교
5. **근태 이슈** — 초과근무, 번아웃 위험
6. **채용 현황** — 파이프라인, 전환율
7. **보상 분석** — Compa-ratio, 밴드 적합도
8. **핵심 리스크** — 즉각 주의가 필요한 항목 (번호 매기기)
9. **추천 액션** — 구체적인 개선 방안 (우선순위 순)

전문적이고 간결하게, 데이터 기반으로 작성하세요.`,
    prompt: dataSummary,
    maxTokens: 4096,
    companyId: companyId ?? user.companyId,
  })

  return {
    content: result.content,
    generatedAt: new Date().toISOString(),
    companyId: companyId ?? null,
  }
}
