// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Certificate PDF Generator
// 재직증명서 / 경력증명서 HTML 템플릿 → Buffer
// 패턴: src/lib/payroll/pdf.ts (HTML → Buffer)
// ═══════════════════════════════════════════════════════════

import { serverT } from '@/lib/server-i18n'
import type { Locale } from '@/i18n/config'

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

export async function generateEmploymentCertPdf(
  locale: Locale,
  employee: EmployeeInfo,
  company: CompanyInfo,
  purpose?: string,
): Promise<Buffer> {
  const t = (key: string) => serverT(locale, key)

  const [lTitle, lSub, lName, lEmpNo, lBirth, lHire, lDept, lGrade, lPos, lPurpose, lDefaultPurpose, lCertify, lSeal] = await Promise.all([
    t('documents.certificate.employment.title'), t('documents.certificate.employment.subtitle'),
    t('documents.certificate.name'), t('documents.certificate.employeeNo'),
    t('documents.certificate.birthDate'), t('documents.certificate.hireDate'),
    t('documents.certificate.department'), t('documents.certificate.jobGrade'),
    t('documents.certificate.position'), t('documents.certificate.purpose'),
    t('documents.certificate.defaultPurpose'), t('documents.certificate.certify'), t('documents.certificate.seal'),
  ])

  const htmlLang = locale === 'ko' ? 'ko' : locale
  const html = `<!DOCTYPE html>
<html lang="${htmlLang}">
<head><meta charset="UTF-8"><style>${CSS}</style></head>
<body>
  <div class="header">
    <h1>${lTitle}</h1>
    <div class="sub">${lSub}</div>
  </div>

  <table>
    <tr><th>${lName}</th><td>${employee.name}</td><th>${lEmpNo}</th><td>${employee.employeeNo}</td></tr>
    <tr><th>${lBirth}</th><td>${formatDate(employee.birthDate)}</td><th>${lHire}</th><td>${formatDate(employee.hireDate)}</td></tr>
    <tr><th>${lDept}</th><td>${employee.departmentName}</td><th>${lGrade}</th><td>${employee.jobGradeName}</td></tr>
    <tr><th>${lPos}</th><td colspan="3">${employee.positionName}</td></tr>
  </table>

  <div class="purpose">
    <strong>${lPurpose}:</strong> ${purpose || lDefaultPurpose}
  </div>

  <p>${lCertify}</p>

  <div class="footer">
    <div class="date">${todayFormatted()}</div>
    <div class="company">${company.name}</div>
    <div class="seal">${lSeal}</div>
  </div>
</body>
</html>`

  return Buffer.from(html, 'utf-8')
}

// ─── 경력증명서 ──────────────────────────────────────────────

export async function generateCareerCertPdf(
  locale: Locale,
  employee: EmployeeInfo,
  company: CompanyInfo,
  assignments: AssignmentHistory[],
  purpose?: string,
): Promise<Buffer> {
  const t = (key: string) => serverT(locale, key)

  const [lTitle, lSub, lName, lEmpNo, lBirth, lHire, lHistory, lDept, lPos, lStart, lEnd, lCurrent, lPurpose, lDefaultPurpose, lCertify, lSeal] = await Promise.all([
    t('documents.certificate.career.title'), t('documents.certificate.career.subtitle'),
    t('documents.certificate.name'), t('documents.certificate.employeeNo'),
    t('documents.certificate.birthDate'), t('documents.certificate.hireDate'),
    t('documents.certificate.career.history'), t('documents.certificate.career.department'),
    t('documents.certificate.career.position'), t('documents.certificate.career.startDate'),
    t('documents.certificate.career.endDate'), t('documents.certificate.career.current'),
    t('documents.certificate.purpose'), t('documents.certificate.defaultPurpose'),
    t('documents.certificate.certify'), t('documents.certificate.seal'),
  ])

  const rows = assignments
    .map(
      (a) => `<tr>
        <td>${a.departmentName}</td>
        <td>${a.positionName}</td>
        <td>${formatDate(a.startDate)}</td>
        <td>${a.endDate ? formatDate(a.endDate) : lCurrent}</td>
      </tr>`,
    )
    .join('\n')

  const htmlLang = locale === 'ko' ? 'ko' : locale
  const html = `<!DOCTYPE html>
<html lang="${htmlLang}">
<head><meta charset="UTF-8"><style>${CSS}</style></head>
<body>
  <div class="header">
    <h1>${lTitle}</h1>
    <div class="sub">${lSub}</div>
  </div>

  <table>
    <tr><th>${lName}</th><td>${employee.name}</td><th>${lEmpNo}</th><td>${employee.employeeNo}</td></tr>
    <tr><th>${lBirth}</th><td>${formatDate(employee.birthDate)}</td><th>${lHire}</th><td>${formatDate(employee.hireDate)}</td></tr>
  </table>

  <h3 style="margin-top:30px;">${lHistory}</h3>
  <table>
    <thead>
      <tr><th>${lDept}</th><th>${lPos}</th><th>${lStart}</th><th>${lEnd}</th></tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="purpose">
    <strong>${lPurpose}:</strong> ${purpose || lDefaultPurpose}
  </div>

  <p>${lCertify}</p>

  <div class="footer">
    <div class="date">${todayFormatted()}</div>
    <div class="company">${company.name}</div>
    <div class="seal">${lSeal}</div>
  </div>
</body>
</html>`

  return Buffer.from(html, 'utf-8')
}
