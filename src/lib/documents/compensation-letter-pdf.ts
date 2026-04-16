// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Compensation Letter PDF Generator
// 연봉 조정 통보서 HTML 템플릿 → Buffer
// 패턴: src/lib/documents/certificate-pdf.ts (HTML → Buffer)
// ═══════════════════════════════════════════════════════════

import { serverT } from '@/lib/server-i18n'
import type { Locale } from '@/i18n/config'

export interface CompensationLetterData {
  companyName: string
  employeeName: string
  employeeNo: string
  departmentName: string
  positionName: string
  previousBaseSalary: number
  newBaseSalary: number
  changePct: number
  changeType: string
  effectiveDate: string
  currency: string
  approverName: string
}

// ─── History → LetterData 변환 헬퍼 ────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildLetterData(history: any, primaryAssignment: any): CompensationLetterData {
  return {
    companyName: history.company?.name ?? '-',
    employeeName: history.employee?.name ?? '-',
    employeeNo: history.employee?.employeeNo ?? '-',
    departmentName: primaryAssignment?.department?.name ?? '-',
    positionName: primaryAssignment?.position?.titleKo ?? '-',
    previousBaseSalary: Number(history.previousBaseSalary),
    newBaseSalary: Number(history.newBaseSalary),
    changePct: Number(history.changePct),
    changeType: history.changeType,
    effectiveDate: history.effectiveDate instanceof Date
      ? history.effectiveDate.toISOString().split('T')[0]
      : String(history.effectiveDate).split('T')[0],
    currency: history.currency,
    approverName: history.approver?.name ?? '-',
  }
}

// ─── 통화 포맷 ──────────────────────────────────────────────

const CURRENCY_FORMATTERS: Record<string, Intl.NumberFormat> = {
  KRW: new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }),
  USD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
  CNY: new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }),
  PLN: new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }),
  RUB: new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }),
  MXN: new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }),
  VND: new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }),
}

function formatAmount(amount: number, currency: string): string {
  const formatter = CURRENCY_FORMATTERS[currency]
  if (formatter) return formatter.format(amount)
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
}

// ─── 변경 유형 라벨 (resolved via i18n) ────────────────────

async function getChangeTypeLabel(locale: Locale, changeType: string): Promise<string> {
  const label = await serverT(locale, `documents.compensation.changeTypes.${changeType}`)
  // serverT falls back to key itself if not found
  return label === `documents.compensation.changeTypes.${changeType}` ? changeType : label
}

// ─── CSS (다국어 폰트 방어) ──────────────────────────────────

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;600;700&family=Noto+Sans+SC:wght@400;600&family=Noto+Sans:wght@400;600;700&display=swap');
  body {
    font-family: 'Noto Sans KR', 'Noto Sans SC', 'Noto Sans', sans-serif;
    margin: 50px;
    color: #222;
    line-height: 1.8;
    letter-spacing: -0.02em;
  }
  .header {
    text-align: center;
    margin-bottom: 40px;
    padding-bottom: 20px;
    border-bottom: 2px solid #333;
  }
  .header .company-name {
    font-size: 16px;
    font-weight: 600;
    color: #555;
    margin-bottom: 8px;
  }
  .header h1 {
    font-size: 28px;
    font-weight: 700;
    letter-spacing: 6px;
    margin: 0;
  }
  .header .sub {
    font-size: 13px;
    color: #666;
    margin-top: 4px;
  }
  .greeting {
    margin: 30px 0 20px;
    font-size: 15px;
    line-height: 1.8;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 20px 0;
  }
  th, td {
    border: 1px solid #ddd;
    padding: 10px 14px;
    font-size: 14px;
    word-break: keep-all;
    white-space: pre-wrap;
    overflow-wrap: break-word;
  }
  th {
    background: #f7f7f7;
    font-weight: 600;
    text-align: left;
    width: 130px;
  }
  td.amount {
    text-align: right;
    font-family: 'Noto Sans', monospace;
    font-variant-numeric: tabular-nums;
  }
  .highlight {
    background: #f0f9ff;
    font-weight: 700;
  }
  .change-pct {
    color: #059669;
    font-weight: 600;
  }
  .body-text {
    margin: 30px 0;
    font-size: 14px;
    line-height: 2;
  }
  .footer {
    margin-top: 60px;
    text-align: center;
  }
  .footer .date {
    font-size: 14px;
    color: #666;
    margin-bottom: 20px;
  }
  .footer .company {
    font-size: 16px;
    font-weight: 600;
  }
  .footer .approver {
    margin-top: 30px;
    font-size: 14px;
  }
  .seal {
    margin-top: 8px;
    font-size: 12px;
    color: #999;
  }
`

// ─── PDF 생성 ────────────────────────────────────────────────

export async function generateCompensationLetterPdf(locale: Locale, data: CompensationLetterData): Promise<Buffer> {
  const t = (key: string, params?: Record<string, string | number>) => serverT(locale, key, params)
  const increase = data.newBaseSalary - data.previousBaseSalary
  const changeSign = increase >= 0 ? '+' : ''

  // Resolve all labels
  const [lTitle, lSubtitle, lGreeting, lBody, lName, lEmpNo, lDept, lPos, lAdjType, lPrevSalary, lNewSalary, lChangeRate, lChangeAmt, lEffDate, lBodyText, lApprover, lSeal] = await Promise.all([
    t('documents.compensation.title'), t('documents.compensation.subtitle'),
    t('documents.compensation.greeting', { name: data.employeeName }),
    t('documents.compensation.body'), t('documents.compensation.name'),
    t('documents.compensation.employeeNo'), t('documents.compensation.department'),
    t('documents.compensation.position'), t('documents.compensation.adjustmentType'),
    t('documents.compensation.previousSalary'), t('documents.compensation.newSalary'),
    t('documents.compensation.changeRate'), t('documents.compensation.changeAmount'),
    t('documents.compensation.effectiveDate'), t('documents.compensation.bodyText'),
    t('documents.compensation.approver', { name: data.approverName }),
    t('documents.certificate.seal'),
  ])
  const changeTypeLabel = await getChangeTypeLabel(locale, data.changeType)

  const htmlLang = locale === 'ko' ? 'ko' : locale
  const html = `<!DOCTYPE html>
<html lang="${htmlLang}">
<head><meta charset="UTF-8"><style>${CSS}</style></head>
<body>
  <div class="header">
    <div class="company-name">${escapeHtml(data.companyName)}</div>
    <h1>${escapeHtml(lTitle)}</h1>
    <div class="sub">${escapeHtml(lSubtitle)}</div>
  </div>

  <div class="greeting">
    ${escapeHtml(lGreeting)}<br>
    ${escapeHtml(lBody)}
  </div>

  <table>
    <tr><th>${escapeHtml(lName)}</th><td>${escapeHtml(data.employeeName)}</td><th>${escapeHtml(lEmpNo)}</th><td>${escapeHtml(data.employeeNo)}</td></tr>
    <tr><th>${escapeHtml(lDept)}</th><td>${escapeHtml(data.departmentName)}</td><th>${escapeHtml(lPos)}</th><td>${escapeHtml(data.positionName)}</td></tr>
  </table>

  <table>
    <tr><th>${escapeHtml(lAdjType)}</th><td colspan="3">${escapeHtml(changeTypeLabel)}</td></tr>
    <tr><th>${escapeHtml(lPrevSalary)}</th><td class="amount">${formatAmount(data.previousBaseSalary, data.currency)}</td><th>${escapeHtml(lNewSalary)}</th><td class="amount highlight">${formatAmount(data.newBaseSalary, data.currency)}</td></tr>
    <tr><th>${escapeHtml(lChangeRate)}</th><td class="change-pct">${changeSign}${data.changePct.toFixed(1)}%</td><th>${escapeHtml(lChangeAmt)}</th><td class="amount">${changeSign}${formatAmount(Math.abs(increase), data.currency)}</td></tr>
    <tr><th>${escapeHtml(lEffDate)}</th><td colspan="3">${escapeHtml(data.effectiveDate)}</td></tr>
  </table>

  <div class="body-text">
    ${escapeHtml(lBodyText).replace(/\n/g, '<br>')}
  </div>

  <div class="footer">
    <div class="date">${todayFormatted()}</div>
    <div class="company">${escapeHtml(data.companyName)}</div>
    <div class="approver">${escapeHtml(lApprover)}</div>
    <div class="seal">${escapeHtml(lSeal)}</div>
  </div>
</body>
</html>`

  return Buffer.from(html, 'utf-8')
}

// ─── Helpers ─────────────────────────────────────────────────

function todayFormatted(): string {
  return new Date().toISOString().split('T')[0]
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
