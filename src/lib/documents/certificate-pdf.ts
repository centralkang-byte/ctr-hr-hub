// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Certificate PDF Generator
// 재직증명서 / 경력증명서 HTML 템플릿 → Buffer
// 패턴: src/lib/payroll/pdf.ts (HTML → Buffer)
// ═══════════════════════════════════════════════════════════

interface EmployeeInfo {
  name: string
  employeeNo: string
  birthDate: string | null
  hireDate: string
  departmentName: string
  positionName: string
  jobGradeName: string
}

interface CompanyInfo {
  name: string
  code: string
  countryCode: string
}

interface AssignmentHistory {
  departmentName: string
  positionName: string
  startDate: string
  endDate: string | null
}

function formatDate(d: string | Date | null): string {
  if (!d) return '-'
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toISOString().split('T')[0]
}

function todayFormatted(): string {
  return new Date().toISOString().split('T')[0]
}

const CSS = `
  body { font-family: 'Noto Sans KR', sans-serif; margin: 40px; color: #222; line-height: 1.8; }
  .header { text-align: center; margin-bottom: 40px; }
  .header h1 { font-size: 28px; font-weight: 700; letter-spacing: 8px; margin-bottom: 4px; }
  .header .sub { font-size: 13px; color: #666; }
  table { width: 100%; border-collapse: collapse; margin: 20px 0; }
  th, td { border: 1px solid #ddd; padding: 10px 14px; font-size: 14px; }
  th { background: #f7f7f7; font-weight: 600; text-align: left; width: 120px; }
  .purpose { margin: 30px 0; font-size: 15px; }
  .footer { margin-top: 60px; text-align: center; }
  .footer .date { font-size: 14px; color: #666; margin-bottom: 20px; }
  .footer .company { font-size: 16px; font-weight: 600; }
  .seal { margin-top: 10px; font-size: 12px; color: #999; }
`

// ─── 재직증명서 ──────────────────────────────────────────────

export function generateEmploymentCertPdf(
  employee: EmployeeInfo,
  company: CompanyInfo,
  purpose?: string,
): Buffer {
  const html = `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><style>${CSS}</style></head>
<body>
  <div class="header">
    <h1>재 직 증 명 서</h1>
    <div class="sub">Certificate of Employment</div>
  </div>

  <table>
    <tr><th>성명</th><td>${employee.name}</td><th>사원번호</th><td>${employee.employeeNo}</td></tr>
    <tr><th>생년월일</th><td>${formatDate(employee.birthDate)}</td><th>입사일</th><td>${formatDate(employee.hireDate)}</td></tr>
    <tr><th>부서</th><td>${employee.departmentName}</td><th>직급</th><td>${employee.jobGradeName}</td></tr>
    <tr><th>직위</th><td colspan="3">${employee.positionName}</td></tr>
  </table>

  <div class="purpose">
    <strong>용도:</strong> ${purpose || '제출용'}
  </div>

  <p>위 사실을 증명합니다.</p>

  <div class="footer">
    <div class="date">${todayFormatted()}</div>
    <div class="company">${company.name}</div>
    <div class="seal">[직인]</div>
  </div>
</body>
</html>`

  return Buffer.from(html, 'utf-8')
}

// ─── 경력증명서 ──────────────────────────────────────────────

export function generateCareerCertPdf(
  employee: EmployeeInfo,
  company: CompanyInfo,
  assignments: AssignmentHistory[],
  purpose?: string,
): Buffer {
  const rows = assignments
    .map(
      (a) => `<tr>
        <td>${a.departmentName}</td>
        <td>${a.positionName}</td>
        <td>${formatDate(a.startDate)}</td>
        <td>${a.endDate ? formatDate(a.endDate) : '재직 중'}</td>
      </tr>`,
    )
    .join('\n')

  const html = `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><style>${CSS}</style></head>
<body>
  <div class="header">
    <h1>경 력 증 명 서</h1>
    <div class="sub">Certificate of Career</div>
  </div>

  <table>
    <tr><th>성명</th><td>${employee.name}</td><th>사원번호</th><td>${employee.employeeNo}</td></tr>
    <tr><th>생년월일</th><td>${formatDate(employee.birthDate)}</td><th>입사일</th><td>${formatDate(employee.hireDate)}</td></tr>
  </table>

  <h3 style="margin-top:30px;">경력 사항</h3>
  <table>
    <thead>
      <tr><th>부서</th><th>직위</th><th>시작일</th><th>종료일</th></tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="purpose">
    <strong>용도:</strong> ${purpose || '제출용'}
  </div>

  <p>위 사실을 증명합니다.</p>

  <div class="footer">
    <div class="date">${todayFormatted()}</div>
    <div class="company">${company.name}</div>
    <div class="seal">[직인]</div>
  </div>
</body>
</html>`

  return Buffer.from(html, 'utf-8')
}
