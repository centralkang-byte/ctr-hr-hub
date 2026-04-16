// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Payroll Excel Generators (GP#3-B)
// src/lib/payroll/excel-generators.ts
// ═══════════════════════════════════════════════════════════
//
// xlsx 0.18.5 사용 (package.json에 이미 포함)
// 3가지 Excel 출력:
//   1. 전월 대비 비교표 (comparison)
//   2. 급여대장 (ledger)
//   3. 인건비 전표 (journal)
// ═══════════════════════════════════════════════════════════

import * as XLSX from 'xlsx'
import { serverT } from '@/lib/server-i18n'
import type { Locale } from '@/i18n/config'

// ─── 계정과목 매핑 ─────────────────────────────────────────

// Settings-connected: account code mapping (codes only, names resolved via i18n)
const ACCOUNT_CODES = {
    basePay: '811',
    allowances: '812',
    welfare: '822',
    socialInsurance: '831',
    retirement: '826',
} as const

// ─── Excel sheet name sanitizer (31 chars max, no []:*?/\) ──

function sanitizeSheetName(name: string): string {
  return name.replace(/[[\]*?/\\:]/g, '').slice(0, 31)
}

// ─── 헤더 스타일 정의 ─────────────────────────────────────

function applyHeaderStyle(ws: XLSX.WorkSheet, range: XLSX.Range): void {
    // xlsx 셀 스타일: xlsx.js 기본 스타일 지원 제한 있음
    // SheetJS Community Edition은 스타일 지원이 제한적이므로 comment로 대신
    void ws
    void range
    // Note: 스타일링은 SheetJS Pro 기능. 기본 헤더만 표시.
}

// ─── 통화 포맷 ──────────────────────────────────────────

function formatKRW(v: number | null | undefined): string {
    if (v == null) return '—'
    return v.toLocaleString('ko-KR')
}

function signedKRW(v: number): string {
    if (v === 0) return '—'
    return (v > 0 ? '+' : '') + v.toLocaleString('ko-KR')
}

// ─── 1. 전월 대비 비교표 ─────────────────────────────────

export interface ComparisonExcelRow {
    employeeNo: string
    employeeName: string
    department: string
    currentNet: number
    previousNet: number | null
    diffNet: number
    diffPercent: number
    changeReason: string | null
    hasAnomaly: boolean
    yearMonth: string
    previousYearMonth: string
}

// ─── xlsx Buffer → Uint8Array ────────────────────────────

function toArrayBuffer(wb: XLSX.WorkBook): ArrayBuffer {
    const arr = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as number[]
    const uint8 = new Uint8Array(arr)
    return uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength)
}

export async function generateComparisonExcel(
    locale: Locale,
    yearMonth: string,
    rows: ComparisonExcelRow[],
    summary: {
        currentTotal: number
        previousTotal: number
        diff: number
        diffPercent: number
        employeesIncreased: number
        employeesDecreased: number
        employeesUnchanged: number
    },
): Promise<ArrayBuffer> {
    const t = (key: string, params?: Record<string, string | number>) => serverT(locale, key, params)
    const wb = XLSX.utils.book_new()

    // Resolve all labels upfront (serverT is async, XLSX APIs are sync)
    const [docTitle, hEmpNo, hName, hDept, hCurrentNet, hPrevNet, hDiff, hDiffPct, hReason, hAnomaly, hTotal,
      sheetTitle, summarySheet, sItem, sValue, sMonth, sCurrentTotal, sPrevTotal, sDiff, sDiffPct, sInc, sDec, sUnchanged] = await Promise.all([
      t('payroll.export.comparison.docTitle', { yearMonth }),
      t('payroll.export.comparison.employeeNo'), t('payroll.export.comparison.name'), t('payroll.export.comparison.department'),
      t('payroll.export.comparison.currentNet', { yearMonth }), t('payroll.export.comparison.previousNet'),
      t('payroll.export.comparison.diff'), t('payroll.export.comparison.diffPercent'),
      t('payroll.export.comparison.reason'), t('payroll.export.comparison.anomaly'), t('payroll.export.comparison.total'),
      t('payroll.export.comparison.sheetTitle'), t('payroll.export.comparison.summarySheet'),
      t('payroll.export.comparison.summaryItem'), t('payroll.export.comparison.summaryValue'),
      t('payroll.export.comparison.summaryMonth'), t('payroll.export.comparison.summaryCurrentTotal'),
      t('payroll.export.comparison.summaryPreviousTotal'), t('payroll.export.comparison.summaryDiff'),
      t('payroll.export.comparison.summaryDiffPercent'), t('payroll.export.comparison.summaryIncreased'),
      t('payroll.export.comparison.summaryDecreased'), t('payroll.export.comparison.summaryUnchanged'),
    ])

    const sheetData = [
        [docTitle], [],
        [hEmpNo, hName, hDept, hCurrentNet, hPrevNet, hDiff, hDiffPct, hReason, hAnomaly],
        ...rows.map((r) => [
            r.employeeNo, r.employeeName, r.department,
            r.currentNet, r.previousNet ?? '', r.diffNet, r.diffPercent,
            r.changeReason ?? '', r.hasAnomaly ? '⚠️' : '',
        ]),
        [],
        [hTotal, '', '', summary.currentTotal, summary.previousTotal, summary.diff, summary.diffPercent, '', ''],
    ]

    const ws1 = XLSX.utils.aoa_to_sheet(sheetData)
    ws1['!cols'] = [
        { wch: 12 }, { wch: 15 }, { wch: 18 }, { wch: 16 }, { wch: 16 },
        { wch: 14 }, { wch: 10 }, { wch: 24 }, { wch: 8 },
    ]
    XLSX.utils.book_append_sheet(wb, ws1, sanitizeSheetName(sheetTitle))

    const summaryData = [
        [sItem, sValue],
        [sMonth, yearMonth],
        [sCurrentTotal, summary.currentTotal],
        [sPrevTotal, summary.previousTotal],
        [sDiff, summary.diff],
        [sDiffPct, summary.diffPercent],
        [sInc, summary.employeesIncreased],
        [sDec, summary.employeesDecreased],
        [sUnchanged, summary.employeesUnchanged],
    ]
    const ws2 = XLSX.utils.aoa_to_sheet(summaryData)
    ws2['!cols'] = [{ wch: 24 }, { wch: 16 }]
    XLSX.utils.book_append_sheet(wb, ws2, sanitizeSheetName(summarySheet))

    return toArrayBuffer(wb)
}

// ─── 2. 급여대장 ─────────────────────────────────────────

export interface LedgerRow {
    employeeNo: string
    employeeName: string
    department: string
    jobGrade: string
    baseSalary: number
    overtimePay: number
    nightPay: number
    holidayPay: number
    positionAllowance: number
    mealAllowance: number
    transportAllowance: number
    grossPay: number
    nationalPension: number
    healthInsurance: number
    longTermCare: number
    employmentInsurance: number
    incomeTax: number
    localIncomeTax: number
    totalDeductions: number
    netPay: number
}

export async function generateLedgerExcel(locale: Locale, yearMonth: string, rows: LedgerRow[]): Promise<ArrayBuffer> {
    const t = (key: string, params?: Record<string, string | number>) => serverT(locale, key, params)
    const wb = XLSX.utils.book_new()

    const headers = await Promise.all([
        t('payroll.export.ledger.employeeNo'), t('payroll.export.ledger.name'),
        t('payroll.export.ledger.department'), t('payroll.export.ledger.jobGrade'),
        t('payroll.export.ledger.baseSalary'), t('payroll.export.ledger.overtimePay'),
        t('payroll.export.ledger.nightPay'), t('payroll.export.ledger.holidayPay'),
        t('payroll.export.ledger.positionAllowance'), t('payroll.export.ledger.mealAllowance'),
        t('payroll.export.ledger.transportAllowance'), t('payroll.export.ledger.grossTotal'),
        t('payroll.export.ledger.nationalPension'), t('payroll.export.ledger.healthInsurance'),
        t('payroll.export.ledger.longTermCare'), t('payroll.export.ledger.employmentInsurance'),
        t('payroll.export.ledger.incomeTax'), t('payroll.export.ledger.localIncomeTax'),
        t('payroll.export.ledger.deductionTotal'), t('payroll.export.ledger.netPay'),
    ])

    const [docTitle, sheetTitle, hTotal] = await Promise.all([
        t('payroll.export.ledger.docTitle', { yearMonth }),
        t('payroll.export.ledger.sheetTitle'),
        t('payroll.export.ledger.total'),
    ])

    const sheetData = [
        [docTitle], [], headers,
        ...rows.map((r) => [
            r.employeeNo, r.employeeName, r.department, r.jobGrade,
            r.baseSalary, r.overtimePay, r.nightPay, r.holidayPay, r.positionAllowance,
            r.mealAllowance, r.transportAllowance, r.grossPay,
            r.nationalPension, r.healthInsurance, r.longTermCare,
            r.employmentInsurance, r.incomeTax, r.localIncomeTax, r.totalDeductions,
            r.netPay,
        ]),
        // 합계
        [],
        [hTotal, '', '', '',
            rows.reduce((s, r) => s + r.baseSalary, 0),
            rows.reduce((s, r) => s + r.overtimePay, 0),
            rows.reduce((s, r) => s + r.nightPay, 0),
            rows.reduce((s, r) => s + r.holidayPay, 0),
            rows.reduce((s, r) => s + r.positionAllowance, 0),
            rows.reduce((s, r) => s + r.mealAllowance, 0),
            rows.reduce((s, r) => s + r.transportAllowance, 0),
            rows.reduce((s, r) => s + r.grossPay, 0),
            rows.reduce((s, r) => s + r.nationalPension, 0),
            rows.reduce((s, r) => s + r.healthInsurance, 0),
            rows.reduce((s, r) => s + r.longTermCare, 0),
            rows.reduce((s, r) => s + r.employmentInsurance, 0),
            rows.reduce((s, r) => s + r.incomeTax, 0),
            rows.reduce((s, r) => s + r.localIncomeTax, 0),
            rows.reduce((s, r) => s + r.totalDeductions, 0),
            rows.reduce((s, r) => s + r.netPay, 0),
        ],
    ]

    const ws = XLSX.utils.aoa_to_sheet(sheetData)
    ws['!cols'] = [
        { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 12 },
        { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 14 },
        { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 14 },
        { wch: 14 },
    ]

    XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(sheetTitle))
    return toArrayBuffer(wb)
}

// ─── 3. 인건비 전표 ──────────────────────────────────────

export interface JournalRow {
    department: string
    basePay: number
    allowances: number
    welfare: number
    socialInsurance: number
    retirement: number
    total: number
}

export async function generateJournalExcel(locale: Locale, yearMonth: string, rows: JournalRow[]): Promise<ArrayBuffer> {
    const t = (key: string, params?: Record<string, string | number>) => serverT(locale, key, params)
    const wb = XLSX.utils.book_new()

    // Resolve account names and labels
    const [aSalary, aAllow, aWelfare, aSocial, aRetire] = await Promise.all([
        t('payroll.export.journal.accountNames.salary'),
        t('payroll.export.journal.accountNames.allowances'),
        t('payroll.export.journal.accountNames.welfare'),
        t('payroll.export.journal.accountNames.socialInsurance'),
        t('payroll.export.journal.accountNames.retirement'),
    ])
    const [docTitle, sheetTitle, hDept, hTotal, mappingSheet, mItem, mCode, mName] = await Promise.all([
        t('payroll.export.journal.docTitle', { yearMonth }),
        t('payroll.export.journal.sheetTitle'),
        t('payroll.export.journal.department'),
        t('payroll.export.journal.total'),
        t('payroll.export.journal.mappingSheet'),
        t('payroll.export.journal.mappingItem'),
        t('payroll.export.journal.mappingCode'),
        t('payroll.export.journal.mappingName'),
    ])

    const headers = [
        hDept,
        `${aSalary}(${ACCOUNT_CODES.basePay})`,
        `${aAllow}(${ACCOUNT_CODES.allowances})`,
        `${aWelfare}(${ACCOUNT_CODES.welfare})`,
        `${aSocial}(${ACCOUNT_CODES.socialInsurance})`,
        `${aRetire}(${ACCOUNT_CODES.retirement})`,
        hTotal,
    ]

    const sheetData = [
        [docTitle], [], headers,
        ...rows.map((r) => [
            r.department, r.basePay, r.allowances, r.welfare, r.socialInsurance, r.retirement, r.total,
        ]),
        [],
        [
            hTotal,
            rows.reduce((s, r) => s + r.basePay, 0),
            rows.reduce((s, r) => s + r.allowances, 0),
            rows.reduce((s, r) => s + r.welfare, 0),
            rows.reduce((s, r) => s + r.socialInsurance, 0),
            rows.reduce((s, r) => s + r.retirement, 0),
            rows.reduce((s, r) => s + r.total, 0),
        ],
    ]

    const ws1 = XLSX.utils.aoa_to_sheet(sheetData)
    ws1['!cols'] = [{ wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 16 }]
    XLSX.utils.book_append_sheet(wb, ws1, sanitizeSheetName(sheetTitle))

    const accountNames = [aSalary, aAllow, aWelfare, aSocial, aRetire]
    const accountCodes = [ACCOUNT_CODES.basePay, ACCOUNT_CODES.allowances, ACCOUNT_CODES.welfare, ACCOUNT_CODES.socialInsurance, ACCOUNT_CODES.retirement]
    const mappingData = [
        [mItem, mCode, mName],
        ...accountNames.map((name, i) => [name, accountCodes[i], name]),
    ]
    const ws2 = XLSX.utils.aoa_to_sheet(mappingData)
    ws2['!cols'] = [{ wch: 18 }, { wch: 12 }, { wch: 18 }]
    XLSX.utils.book_append_sheet(wb, ws2, sanitizeSheetName(mappingSheet))

    return toArrayBuffer(wb)
}

// ─── 파일명 생성 유틸 ─────────────────────────────────────

export async function buildExcelFilename(
    locale: Locale,
    companyId: string,
    yearMonth: string,
    type: 'comparison' | 'ledger' | 'journal',
): Promise<string> {
    const t = (key: string, params?: Record<string, string | number>) => serverT(locale, key, params)
    const [yr, mn] = yearMonth.split('-')
    const yearLabel = await t('payroll.export.filename.yearMonth', { year: yr, month: mn })
    const typeLabel = await t(`payroll.export.filename.${type}`)
    return `${companyId}_${yearLabel}_${typeLabel}.xlsx`
}

// ─── 타입 re-export (for unused warning suppression) ─────

export { formatKRW, signedKRW, applyHeaderStyle }
