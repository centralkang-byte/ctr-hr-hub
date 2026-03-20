// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Withholding Receipt PDF Generator
// 원천징수영수증 PDF 생성 (HTML → Buffer)
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'

function formatKRW(amount: bigint | number | string): string {
  const num = typeof amount === 'string' ? parseInt(amount, 10) : Number(amount)
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(num)
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '-'
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toISOString().split('T')[0]
}

function bigintToNum(v: bigint | number): number {
  return typeof v === 'bigint' ? Number(v) : v
}

export async function generateWithholdingReceiptPdf(
  settlementId: string,
): Promise<Buffer> {
  // Fetch settlement with all details
  const settlement = await prisma.yearEndSettlement.findUnique({
    where: { id: settlementId },
    include: {
      employee: {
        select: {
          name: true,
          employeeNo: true,
          birthDate: true,
          assignments: {
            where: { isPrimary: true, endDate: null },
            take: 1,
            include: {
              company: { select: { name: true } },
              department: { select: { name: true } },
              jobGrade: { select: { name: true } },
            },
          },
        },
      },
      dependents: { orderBy: { createdAt: 'asc' } },
      deductions: { orderBy: { createdAt: 'asc' } },
    },
  })

  if (!settlement) {
    throw new Error('정산 정보를 찾을 수 없습니다.')
  }

  const employee = settlement.employee
  const assignment = extractPrimaryAssignment(employee.assignments ?? [])
  const companyName = assignment?.company?.name ?? '-'
  const departmentName = assignment?.department?.name ?? '-'
  const jobGradeName = assignment?.jobGrade?.name ?? '-'

  // Final settlement sign
  const finalSettlementNum = bigintToNum(settlement.finalSettlement)
  const isRefund = finalSettlementNum >= 0
  const finalSettlementLabel = isRefund ? '환급' : '추가납부'
  const finalSettlementColor = isRefund ? '#059669' : '#D97706'

  // Build deduction rows
  const deductionRows = settlement.deductions
    .filter((d) => bigintToNum(d.deductibleAmount) > 0)
    .map(
      (d) => `
      <tr>
        <td style="padding: 6px 8px; border-bottom: 1px solid #F1F5F9; font-size: 12px;">${d.name}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #F1F5F9; font-size: 12px; text-align: right;">${formatKRW(d.inputAmount)}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #F1F5F9; font-size: 12px; text-align: right;">${formatKRW(d.deductibleAmount)}</td>
      </tr>`,
    )
    .join('')

  // Build dependent rows
  const dependentRows = settlement.dependents
    .map(
      (dep) => `
      <tr>
        <td style="padding: 6px 8px; border-bottom: 1px solid #F1F5F9; font-size: 12px;">${dep.name}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #F1F5F9; font-size: 12px;">${dep.relationship}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #F1F5F9; font-size: 12px;">${formatDate(dep.birthDate)}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #F1F5F9; font-size: 12px; text-align: right;">${formatKRW(dep.deductionAmount)}</td>
      </tr>`,
    )
    .join('')

//   const incomeDeductions = settlement.incomeDeductions as Record<string, number> | null
//   const taxCredits = settlement.taxCredits as Record<string, number> | null

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>원천징수영수증 — ${employee.name} (${settlement.year}년)</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Noto Sans KR', 'Malgun Gothic', '맑은 고딕', sans-serif;
      font-size: 13px;
      color: #1A1A1A;
      background: #fff;
      padding: 32px;
    }
    .page-header {
      text-align: center;
      margin-bottom: 24px;
      border-bottom: 2px solid #1A1A1A;
      padding-bottom: 16px;
    }
    .page-header h1 {
      font-size: 22px;
      font-weight: 700;
      letter-spacing: 8px;
      margin-bottom: 4px;
    }
    .page-header .subtitle {
      font-size: 13px;
      color: #555;
    }
    .section {
      margin-bottom: 20px;
    }
    .section-title {
      font-size: 13px;
      font-weight: 700;
      background: #F8FAFC;
      border-left: 4px solid #5E81F4;
      padding: 6px 12px;
      margin-bottom: 8px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 0;
      border: 1px solid #E2E8F0;
      border-radius: 4px;
      overflow: hidden;
    }
    .info-item {
      display: flex;
      padding: 8px 12px;
      border-bottom: 1px solid #E2E8F0;
      border-right: 1px solid #E2E8F0;
    }
    .info-item:nth-child(3n) { border-right: none; }
    .info-label { color: #64748B; font-size: 11px; min-width: 80px; }
    .info-value { font-weight: 600; font-size: 12px; }
    table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #E2E8F0;
      border-radius: 4px;
      overflow: hidden;
    }
    th {
      background: #F8FAFC;
      padding: 8px;
      font-size: 11px;
      font-weight: 600;
      color: #64748B;
      text-align: left;
      border-bottom: 1px solid #E2E8F0;
    }
    th.right { text-align: right; }
    .calculation-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #E2E8F0;
    }
    .calc-row {
      display: flex;
      border-bottom: 1px solid #F1F5F9;
    }
    .calc-label {
      flex: 1;
      padding: 8px 12px;
      font-size: 12px;
      color: #555;
      background: #FAFAFA;
      border-right: 1px solid #F1F5F9;
    }
    .calc-value {
      flex: 1;
      padding: 8px 12px;
      font-size: 12px;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .calc-sublabel {
      font-size: 10px;
      color: #94A3B8;
      margin-top: 2px;
    }
    .divider-row .calc-label,
    .divider-row .calc-value {
      background: #F8FAFC;
      font-weight: 700;
      font-size: 13px;
      color: #1A1A1A;
    }
    .final-box {
      margin-top: 20px;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    }
    .final-box.refund { background: #D1FAE5; border: 1px solid #A7F3D0; }
    .final-box.additional { background: #FEF3C7; border: 1px solid #FCD34D; }
    .final-label { font-size: 13px; font-weight: 600; margin-bottom: 8px; }
    .final-amount { font-size: 28px; font-weight: 700; }
    .final-tax { font-size: 13px; color: #555; margin-top: 4px; }
    .footer {
      margin-top: 40px;
      text-align: center;
      font-size: 10px;
      color: #94A3B8;
      border-top: 1px solid #E2E8F0;
      padding-top: 16px;
    }
    .stamp-area {
      display: flex;
      justify-content: flex-end;
      margin-top: 24px;
      gap: 32px;
    }
    .stamp-item {
      text-align: center;
      min-width: 120px;
    }
    .stamp-label { font-size: 11px; color: #555; margin-bottom: 24px; }
    .stamp-line { border-top: 1px solid #1A1A1A; padding-top: 4px; font-size: 11px; }
    @media print {
      body { padding: 16px; }
      .page-break { page-break-before: always; }
    }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="page-header">
    <h1>원 천 징 수 영 수 증</h1>
    <div class="subtitle">(근로소득) — ${settlement.year}년 귀속 연말정산</div>
  </div>

  <!-- Section 1: Employee Info -->
  <div class="section">
    <div class="section-title">1. 소득자 인적 사항</div>
    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">성명</span>
        <span class="info-value">${employee.name}</span>
      </div>
      <div class="info-item">
        <span class="info-label">사번</span>
        <span class="info-value">${employee.employeeNo}</span>
      </div>
      <div class="info-item">
        <span class="info-label">생년월일</span>
        <span class="info-value">${formatDate(employee.birthDate)}</span>
      </div>
      <div class="info-item">
        <span class="info-label">회사</span>
        <span class="info-value">${companyName}</span>
      </div>
      <div class="info-item">
        <span class="info-label">부서</span>
        <span class="info-value">${departmentName}</span>
      </div>
      <div class="info-item">
        <span class="info-label">직급</span>
        <span class="info-value">${jobGradeName}</span>
      </div>
    </div>
  </div>

  <!-- Section 2: Income Summary -->
  <div class="section">
    <div class="section-title">2. 근로소득 명세</div>
    <div class="calculation-table">
      <div class="calc-row">
        <div class="calc-label">
          ① 총급여
          <div class="calc-sublabel">연간 지급 총액</div>
        </div>
        <div class="calc-value">${formatKRW(settlement.totalSalary)}</div>
      </div>
      <div class="calc-row">
        <div class="calc-label">
          ② 근로소득공제
          <div class="calc-sublabel">총급여 구간별 공제</div>
        </div>
        <div class="calc-value">(-) ${formatKRW(settlement.earnedIncomeDeduction)}</div>
      </div>
      <div class="calc-row divider-row">
        <div class="calc-label">③ 근로소득금액 (①-②)</div>
        <div class="calc-value">${formatKRW(settlement.earnedIncome)}</div>
      </div>
      <div class="calc-row">
        <div class="calc-label">
          ④ 종합소득공제
          <div class="calc-sublabel">인적공제 + 특별공제 + 기타</div>
        </div>
        <div class="calc-value">(-) ${formatKRW(settlement.totalIncomeDeduction)}</div>
      </div>
      <div class="calc-row divider-row">
        <div class="calc-label">⑤ 과세표준 (③-④)</div>
        <div class="calc-value">${formatKRW(settlement.taxableBase)}</div>
      </div>
      <div class="calc-row">
        <div class="calc-label">
          ⑥ 세율
          <div class="calc-sublabel">누진세율 적용</div>
        </div>
        <div class="calc-value">${settlement.taxRate ? `${(settlement.taxRate * 100).toFixed(1)}%` : '-'}</div>
      </div>
      <div class="calc-row">
        <div class="calc-label">⑦ 산출세액</div>
        <div class="calc-value">${formatKRW(settlement.calculatedTax)}</div>
      </div>
      <div class="calc-row">
        <div class="calc-label">
          ⑧ 세액공제
          <div class="calc-sublabel">근로소득세액공제 + 기타</div>
        </div>
        <div class="calc-value">(-) ${formatKRW(settlement.totalTaxCredit)}</div>
      </div>
      <div class="calc-row divider-row">
        <div class="calc-label">⑨ 결정세액 (⑦-⑧)</div>
        <div class="calc-value">${formatKRW(settlement.determinedTax)}</div>
      </div>
      <div class="calc-row">
        <div class="calc-label">
          ⑩ 기납부세액
          <div class="calc-sublabel">월별 원천징수 합계</div>
        </div>
        <div class="calc-value">${formatKRW(settlement.prepaidTax)}</div>
      </div>
    </div>
  </div>

  <!-- Section 3: Deductions Detail -->
  ${
    settlement.deductions.length > 0
      ? `
  <div class="section">
    <div class="section-title">3. 소득공제 상세</div>
    <table>
      <thead>
        <tr>
          <th>공제항목</th>
          <th class="right">지출금액</th>
          <th class="right">공제금액</th>
        </tr>
      </thead>
      <tbody>
        ${deductionRows}
        <tr style="background: #F8FAFC; font-weight: 700;">
          <td style="padding: 8px; font-size: 12px;">합계</td>
          <td style="padding: 8px; font-size: 12px; text-align: right;">-</td>
          <td style="padding: 8px; font-size: 12px; text-align: right;">${formatKRW(settlement.totalIncomeDeduction)}</td>
        </tr>
      </tbody>
    </table>
  </div>`
      : ''
  }

  <!-- Section 4: Dependents -->
  ${
    settlement.dependents.length > 0
      ? `
  <div class="section">
    <div class="section-title">4. 부양가족 명세</div>
    <table>
      <thead>
        <tr>
          <th>성명</th>
          <th>관계</th>
          <th>생년월일</th>
          <th class="right">공제금액</th>
        </tr>
      </thead>
      <tbody>
        ${dependentRows}
      </tbody>
    </table>
  </div>`
      : ''
  }

  <!-- Section 5: Final Result -->
  <div class="section">
    <div class="section-title">5. 차감징수세액</div>
    <div class="final-box ${isRefund ? 'refund' : 'additional'}">
      <div class="final-label" style="color: ${finalSettlementColor};">
        ${settlement.year}년 귀속 연말정산 — ${finalSettlementLabel}
      </div>
      <div class="final-amount" style="color: ${finalSettlementColor};">
        ${isRefund ? '' : '▲ '}${formatKRW(Math.abs(finalSettlementNum))}
      </div>
      <div class="final-tax">
        소득세: ${formatKRW(Math.abs(finalSettlementNum))} &nbsp;|&nbsp;
        지방소득세: ${formatKRW(settlement.localTaxSettlement)}
      </div>
      <div style="font-size: 11px; color: #666; margin-top: 8px;">
        * ${isRefund ? '환급액은 급여에 가산하여 지급됩니다.' : '추가납부액은 급여에서 공제됩니다.'}
      </div>
    </div>
  </div>

  <!-- Confirmation stamp area -->
  <div class="stamp-area">
    <div class="stamp-item">
      <div class="stamp-label">소득자 (본인)</div>
      <div class="stamp-line">${employee.name} (인)</div>
    </div>
    <div class="stamp-item">
      <div class="stamp-label">원천징수의무자</div>
      <div class="stamp-line">${companyName} (인)</div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <p>본 원천징수영수증은 ${companyName}에서 ${settlement.year}년 귀속 연말정산 결과에 따라 발행된 전자문서입니다.</p>
    <p style="margin-top: 4px;">발행일: ${formatDate(new Date())} &nbsp;|&nbsp; 소득세법 제143조에 따라 발행</p>
  </div>

</body>
</html>`

  return Buffer.from(html, 'utf-8')
}
