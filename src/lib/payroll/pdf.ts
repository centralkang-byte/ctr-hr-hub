// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Payroll PDF Generator
// 급여명세서 PDF 생성 (HTML → PDF)
// ═══════════════════════════════════════════════════════════

import type { PayrollItemDetail } from './types'
import { serverT } from '@/lib/server-i18n'
import type { Locale } from '@/i18n/config'

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
  locale: Locale,
  item: PayrollItemWithRelations,
): Promise<Buffer> {
  const t = (key: string, params?: Record<string, string | number>) => serverT(locale, key, params)
  const detail = item.detail as unknown as PayrollItemDetail | null

  // Resolve all labels upfront
  const [eBaseSalary, eFixedOT, eMeal, eTransport, eOT, eNight, eHoliday, eBonus, eOther] = await Promise.all([
    t('payroll.pdf.earnings.baseSalary'), t('payroll.pdf.earnings.fixedOvertime'),
    t('payroll.pdf.earnings.meal'), t('payroll.pdf.earnings.transport'),
    t('payroll.pdf.earnings.overtime'), t('payroll.pdf.earnings.nightShift'),
    t('payroll.pdf.earnings.holiday'), t('payroll.pdf.earnings.bonus'), t('payroll.pdf.earnings.other'),
  ])
  const [dNP, dHealth, dLTC, dEmpl, dIncome, dLocal] = await Promise.all([
    t('payroll.pdf.deductions.nationalPension'), t('payroll.pdf.deductions.health'),
    t('payroll.pdf.deductions.longTermCare'), t('payroll.pdf.deductions.employment'),
    t('payroll.pdf.deductions.incomeTax'), t('payroll.pdf.deductions.localIncomeTax'),
  ])
  const [pTitle, pName, pEmpNo, pDept, pGrade, pPeriod, pPayDate, pEarnings, pAmount, pDeductions, pGross, pTotalDed, pNet, pFooter] = await Promise.all([
    t('payroll.pdf.title'), t('payroll.pdf.name'), t('payroll.pdf.employeeNo'),
    t('payroll.pdf.department'), t('payroll.pdf.jobGrade'), t('payroll.pdf.payPeriod'),
    t('payroll.pdf.payDate'), t('payroll.pdf.earningItems'), t('payroll.pdf.amount'),
    t('payroll.pdf.deductionItems'), t('payroll.pdf.grossPay'), t('payroll.pdf.totalDeductions'),
    t('payroll.pdf.netPay'), t('payroll.pdf.footer', { company: item.employee.company.name }),
  ])

  const earningItems = detail
    ? [
        { label: eBaseSalary, value: detail.earnings.baseSalary },
        { label: eFixedOT, value: detail.earnings.fixedOvertimeAllowance },
        { label: eMeal, value: detail.earnings.mealAllowance },
        { label: eTransport, value: detail.earnings.transportAllowance },
        { label: eOT, value: detail.earnings.overtimePay },
        { label: eNight, value: detail.earnings.nightShiftPay },
        { label: eHoliday, value: detail.earnings.holidayPay },
        { label: eBonus, value: detail.earnings.bonuses },
        { label: eOther, value: detail.earnings.otherEarnings },
      ].filter((i) => i.value > 0)
    : []

  const deductionItems = detail
    ? [
        { label: dNP, value: detail.deductions.nationalPension },
        { label: dHealth, value: detail.deductions.healthInsurance },
        { label: dLTC, value: detail.deductions.longTermCare },
        { label: dEmpl, value: detail.deductions.employmentInsurance },
        { label: dIncome, value: detail.deductions.incomeTax },
        { label: dLocal, value: detail.deductions.localIncomeTax },
      ].filter((i) => i.value > 0)
    : []

  const htmlLang = locale === 'ko' ? 'ko' : locale
  const html = `
<!DOCTYPE html>
<html lang="${htmlLang}">
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
  <h1>${pTitle}</h1>
  <p class="subtitle">${item.employee.company.name}</p>

  <div class="info-grid">
    <div class="info-item"><span class="info-label">${pName}</span><span class="info-value">${item.employee.name}</span></div>
    <div class="info-item"><span class="info-label">${pEmpNo}</span><span class="info-value">${item.employee.employeeNo}</span></div>
    <div class="info-item"><span class="info-label">${pDept}</span><span class="info-value">${item.employee.department.name}</span></div>
    <div class="info-item"><span class="info-label">${pGrade}</span><span class="info-value">${item.employee.jobGrade.name}</span></div>
    <div class="info-item"><span class="info-label">${pPeriod}</span><span class="info-value">${formatDate(item.run.periodStart)} ~ ${formatDate(item.run.periodEnd)}</span></div>
    <div class="info-item"><span class="info-label">${pPayDate}</span><span class="info-value">${item.run.payDate ? formatDate(item.run.payDate) : '-'}</span></div>
  </div>

  <div class="two-col">
    <div>
      <table>
        <thead><tr><th>${pEarnings}</th><th class="amount">${pAmount}</th></tr></thead>
        <tbody>
          ${earningItems.map((i) => `<tr><td>${i.label}</td><td class="amount">${formatKRW(i.value)}</td></tr>`).join('')}
          <tr class="total-row"><td>${pGross}</td><td class="amount">${formatKRW(detail?.grossPay ?? Number(item.grossPay))}</td></tr>
        </tbody>
      </table>
    </div>
    <div>
      <table>
        <thead><tr><th>${pDeductions}</th><th class="amount">${pAmount}</th></tr></thead>
        <tbody>
          ${deductionItems.map((i) => `<tr><td>${i.label}</td><td class="amount">${formatKRW(i.value)}</td></tr>`).join('')}
          <tr class="total-row"><td>${pTotalDed}</td><td class="amount">${formatKRW(detail?.totalDeductions ?? Number(item.deductions))}</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <div class="net-pay">
    <div class="net-pay-label">${pNet}</div>
    <div class="net-pay-value">${formatKRW(detail?.netPay ?? Number(item.netPay))}</div>
  </div>

  <div class="footer">
    ${pFooter}
  </div>
</body>
</html>`

  return Buffer.from(html, 'utf-8')
}
