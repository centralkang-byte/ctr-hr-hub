// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Payroll AI Anomaly Detection
// ═══════════════════════════════════════════════════════════

import { callClaude } from '@/lib/claude'
import { serviceUnavailable } from '@/lib/errors'
import { formatCurrency } from '@/lib/compensation'
import type { PayrollAnomalyResult, PayrollItemDetail } from './types'

interface PayrollRunWithItems {
  id: string
  yearMonth: string
  headcount: number
  totalGross: unknown
  totalNet: unknown
  payrollItems: Array<{
    employeeId: string
    baseSalary: unknown
    overtimePay: unknown
    grossPay: unknown
    netPay: unknown
    detail: unknown
    employee: {
      id: string
      name: string
      hireDate: Date
      resignDate: Date | null
    }
  }>
}

export async function payrollAnomalyCheck(
  run: PayrollRunWithItems,
  companyId: string,
  employeeId: string,
): Promise<PayrollAnomalyResult> {
  const itemSummaries = run.payrollItems.map((item) => {
    const detail = item.detail as unknown as PayrollItemDetail | null
    return {
      name: item.employee.name,
      baseSalary: formatCurrency(Number(item.baseSalary)),
      overtimePay: formatCurrency(Number(item.overtimePay)),
      grossPay: formatCurrency(Number(item.grossPay)),
      netPay: formatCurrency(Number(item.netPay)),
      overtimeHours: detail?.overtime?.totalOvertimeHours ?? 0,
      isNewHire: item.employee.hireDate > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      isResigning: !!item.employee.resignDate,
    }
  })

  const newHires = itemSummaries.filter((i) => i.isNewHire)
  const resignations = itemSummaries.filter((i) => i.isResigning)

  const prompt = `당신은 CTR Holdings 급여 감사 전문가입니다.
다음 ${run.yearMonth} 급여 데이터를 분석하여 이상 항목을 찾아주세요.

급여 요약:
- 대상 인원: ${run.headcount}명
- 총 지급액: ${formatCurrency(Number(run.totalGross ?? 0))}
- 총 실지급액: ${formatCurrency(Number(run.totalNet ?? 0))}

직원별 급여:
${itemSummaries
  .map(
    (i) =>
      `- ${i.name}: 기본급=${i.baseSalary}, 초과근무=${i.overtimePay}(${i.overtimeHours}h), 총지급=${i.grossPay}, 실지급=${i.netPay}`,
  )
  .join('\n')}

신규 입사자 (3개월 이내): ${newHires.length > 0 ? newHires.map((h) => h.name).join(', ') : '없음'}
퇴직 예정자: ${resignations.length > 0 ? resignations.map((r) => r.name).join(', ') : '없음'}

이상 감지 기준:
- 초과근무 월 60시간 초과 → WARNING
- 전월 대비 급여 20% 이상 변동 → ERROR
- 신규 입사자 일할 계산 필요 → INFO

아래 JSON 형식으로 응답하세요:
{
  "risk_level": "LOW" | "MEDIUM" | "HIGH",
  "findings": ["발견 사항 1", "발견 사항 2"],
  "items_to_review": [
    {"employeeId": "...", "employeeName": "...", "issue": "...", "severity": "INFO" | "WARNING" | "ERROR"}
  ],
  "recommendation": "종합 권고사항"
}

JSON만 응답하세요.`

  const result = await callClaude({
    feature: 'PAYROLL_ANOMALY_CHECK',
    prompt,
    systemPrompt: 'You are a payroll audit specialist for CTR Holdings. Respond in Korean with JSON only.',
    maxTokens: 2048,
    companyId,
    employeeId,
  })

  try {
    return JSON.parse(result.content) as PayrollAnomalyResult
  } catch {
    throw serviceUnavailable('AI 분석 결과 파싱에 실패했습니다.')
  }
}
