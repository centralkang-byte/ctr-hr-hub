// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Compensation Letter PDF Generator
// 연봉 조정 통보서 HTML 템플릿 → Buffer
// 패턴: src/lib/documents/certificate-pdf.ts (HTML → Buffer)
// ═══════════════════════════════════════════════════════════

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

// ─── 변경 유형 라벨 ──────────────────────────────────────────

const CHANGE_TYPE_LABELS: Record<string, string> = {
  ANNUAL_INCREASE: '정기 연봉 조정',
  PROMOTION: '승진',
  MARKET_ADJUSTMENT: '시장 조정',
  MERIT_INCREASE: '성과 인상',
  EQUITY_ADJUSTMENT: '형평성 조정',
  OTHER: '기타',
}

function getChangeTypeLabel(changeType: string): string {
  return CHANGE_TYPE_LABELS[changeType] ?? changeType
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

export function generateCompensationLetterPdf(data: CompensationLetterData): Buffer {
  const increase = data.newBaseSalary - data.previousBaseSalary
  const changeSign = increase >= 0 ? '+' : ''

  const html = `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><style>${CSS}</style></head>
<body>
  <div class="header">
    <div class="company-name">${escapeHtml(data.companyName)}</div>
    <h1>연봉 조정 통보서</h1>
    <div class="sub">Compensation Adjustment Letter</div>
  </div>

  <div class="greeting">
    <strong>${escapeHtml(data.employeeName)}</strong>님께,<br>
    아래와 같이 연봉 조정 사항을 통보합니다.
  </div>

  <table>
    <tr><th>성명</th><td>${escapeHtml(data.employeeName)}</td><th>사원번호</th><td>${escapeHtml(data.employeeNo)}</td></tr>
    <tr><th>부서</th><td>${escapeHtml(data.departmentName)}</td><th>직위</th><td>${escapeHtml(data.positionName)}</td></tr>
  </table>

  <table>
    <tr><th>조정 유형</th><td colspan="3">${escapeHtml(getChangeTypeLabel(data.changeType))}</td></tr>
    <tr><th>변경 전 연봉</th><td class="amount">${formatAmount(data.previousBaseSalary, data.currency)}</td><th>변경 후 연봉</th><td class="amount highlight">${formatAmount(data.newBaseSalary, data.currency)}</td></tr>
    <tr><th>인상률</th><td class="change-pct">${changeSign}${data.changePct.toFixed(1)}%</td><th>인상액</th><td class="amount">${changeSign}${formatAmount(Math.abs(increase), data.currency)}</td></tr>
    <tr><th>시행일</th><td colspan="3">${escapeHtml(data.effectiveDate)}</td></tr>
  </table>

  <div class="body-text">
    본 조정은 위 시행일부터 적용되며, 변경된 연봉은 해당 시행일이 속한 급여 지급일부터 반영됩니다.<br>
    본 통보서의 내용에 대해 문의 사항이 있으시면 인사팀으로 연락하여 주시기 바랍니다.
  </div>

  <div class="footer">
    <div class="date">${todayFormatted()}</div>
    <div class="company">${escapeHtml(data.companyName)}</div>
    <div class="approver">승인자: ${escapeHtml(data.approverName)}</div>
    <div class="seal">[직인]</div>
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
