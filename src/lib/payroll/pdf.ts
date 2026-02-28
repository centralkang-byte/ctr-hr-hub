// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Payroll PDF Generator
// 급여명세서 PDF 생성 (HTML → PDF)
// ═══════════════════════════════════════════════════════════

import type { PayrollItemDetail } from './types'

interface PayrollItemWithRelations {
  id: string
  baseSalary: unknown
  grossPay: unknown
  deductions: unknown
  netPay: unknown
  detail: unknown
  employee: {
    name: string
    employeeNo: string
    department: { name: string }
    jobGrade: { name: string }
    company: { name: string }
  }
  run: {
    name: string
    yearMonth: string
    periodStart: Date | string
    periodEnd: Date | string
    payDate: Date | string | null
  }
}

function formatKRW(amount: number): string {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toISOString().split('T')[0]
}

export async function generatePayStubPdf(
  item: PayrollItemWithRelations,
): Promise<Buffer> {
  const detail = item.detail as unknown as PayrollItemDetail | null

  const earningItems = detail
    ? [
        { label: '기본급', value: detail.earnings.baseSalary },
        { label: '고정초과근무수당', value: detail.earnings.fixedOvertimeAllowance },
        { label: '식비', value: detail.earnings.mealAllowance },
        { label: '교통비', value: detail.earnings.transportAllowance },
        { label: '연장근무수당', value: detail.earnings.overtimePay },
        { label: '야간근무수당', value: detail.earnings.nightShiftPay },
        { label: '휴일근무수당', value: detail.earnings.holidayPay },
        { label: '상여금', value: detail.earnings.bonuses },
        { label: '기타수당', value: detail.earnings.otherEarnings },
      ].filter((i) => i.value > 0)
    : []

  const deductionItems = detail
    ? [
        { label: '국민연금', value: detail.deductions.nationalPension },
        { label: '건강보험', value: detail.deductions.healthInsurance },
        { label: '장기요양보험', value: detail.deductions.longTermCare },
        { label: '고용보험', value: detail.deductions.employmentInsurance },
        { label: '소득세', value: detail.deductions.incomeTax },
        { label: '지방소득세', value: detail.deductions.localIncomeTax },
      ].filter((i) => i.value > 0)
    : []

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: 'Noto Sans KR', sans-serif; margin: 40px; font-size: 12px; color: #333; }
    h1 { font-size: 20px; text-align: center; margin-bottom: 4px; }
    .subtitle { text-align: center; color: #666; margin-bottom: 24px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 24px; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; }
    .info-item { display: flex; justify-content: space-between; }
    .info-label { color: #666; }
    .info-value { font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th { background: #f8fafc; text-align: left; padding: 8px; border-bottom: 2px solid #e2e8f0; font-size: 11px; color: #64748b; }
    td { padding: 8px; border-bottom: 1px solid #f1f5f9; }
    .amount { text-align: right; font-variant-numeric: tabular-nums; }
    .total-row { background: #f8fafc; font-weight: 700; }
    .net-pay { text-align: center; margin: 24px 0; padding: 16px; background: #eff6ff; border-radius: 8px; }
    .net-pay-label { font-size: 12px; color: #2563eb; }
    .net-pay-value { font-size: 24px; font-weight: 700; color: #1d4ed8; }
    .footer { text-align: center; color: #94a3b8; font-size: 10px; margin-top: 32px; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  </style>
</head>
<body>
  <h1>급 여 명 세 서</h1>
  <p class="subtitle">${item.employee.company.name}</p>

  <div class="info-grid">
    <div class="info-item"><span class="info-label">성명</span><span class="info-value">${item.employee.name}</span></div>
    <div class="info-item"><span class="info-label">사번</span><span class="info-value">${item.employee.employeeNo}</span></div>
    <div class="info-item"><span class="info-label">부서</span><span class="info-value">${item.employee.department.name}</span></div>
    <div class="info-item"><span class="info-label">직급</span><span class="info-value">${item.employee.jobGrade.name}</span></div>
    <div class="info-item"><span class="info-label">급여기간</span><span class="info-value">${formatDate(item.run.periodStart)} ~ ${formatDate(item.run.periodEnd)}</span></div>
    <div class="info-item"><span class="info-label">지급일</span><span class="info-value">${item.run.payDate ? formatDate(item.run.payDate) : '-'}</span></div>
  </div>

  <div class="two-col">
    <div>
      <table>
        <thead><tr><th>지급항목</th><th class="amount">금액</th></tr></thead>
        <tbody>
          ${earningItems.map((i) => `<tr><td>${i.label}</td><td class="amount">${formatKRW(i.value)}</td></tr>`).join('')}
          <tr class="total-row"><td>총 지급액</td><td class="amount">${formatKRW(detail?.grossPay ?? Number(item.grossPay))}</td></tr>
        </tbody>
      </table>
    </div>
    <div>
      <table>
        <thead><tr><th>공제항목</th><th class="amount">금액</th></tr></thead>
        <tbody>
          ${deductionItems.map((i) => `<tr><td>${i.label}</td><td class="amount">${formatKRW(i.value)}</td></tr>`).join('')}
          <tr class="total-row"><td>총 공제액</td><td class="amount">${formatKRW(detail?.totalDeductions ?? Number(item.deductions))}</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <div class="net-pay">
    <div class="net-pay-label">실수령액</div>
    <div class="net-pay-value">${formatKRW(detail?.netPay ?? Number(item.netPay))}</div>
  </div>

  <div class="footer">
    본 급여명세서는 ${item.employee.company.name}에서 발행한 전자문서입니다.
  </div>
</body>
</html>`

  // Use a simple HTML-to-PDF approach — in production, use puppeteer or @react-pdf/renderer
  // For now, return HTML as buffer (can be rendered client-side)
  return Buffer.from(html, 'utf-8')
}
