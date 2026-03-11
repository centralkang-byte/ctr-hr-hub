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

// ─── 계정과목 매핑 ─────────────────────────────────────────

// Settings-connected: account code mapping (defaults below, configurable per company)
const ACCOUNT_MAPPING = {
    basePay: { code: '811', name: '급여' },
    allowances: { code: '812', name: '제수당' },
    welfare: { code: '822', name: '복리후생비' },
    socialInsurance: { code: '831', name: '법정복리후생비' },
    retirement: { code: '826', name: '퇴직급여' },
} as const

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

export function generateComparisonExcel(
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
): ArrayBuffer {
    const wb = XLSX.utils.book_new()

    // ── Sheet 1: 전월 대비 비교 ──────────────────────────────
    const sheetData = [
        // 제목 행
        [`${yearMonth} 급여 전월 대비 비교표`],
        [],
        // 헤더
        ['사번', '이름', '부서', `${yearMonth} 실수령`, '전월 실수령', '차이', '변동률(%)', '사유', '이상여부'],
        // 데이터
        ...rows.map((r) => [
            r.employeeNo,
            r.employeeName,
            r.department,
            r.currentNet,
            r.previousNet ?? '',
            r.diffNet,
            r.diffPercent,
            r.changeReason ?? '',
            r.hasAnomaly ? '⚠️' : '',
        ]),
        // 합계 행
        [],
        ['합계', '', '', summary.currentTotal, summary.previousTotal, summary.diff, summary.diffPercent, '', ''],
    ]

    const ws1 = XLSX.utils.aoa_to_sheet(sheetData)

    // 열 너비 설정
    ws1['!cols'] = [
        { wch: 12 }, // 사번
        { wch: 15 }, // 이름
        { wch: 18 }, // 부서
        { wch: 16 }, // 현재 실수령
        { wch: 16 }, // 전월 실수령
        { wch: 14 }, // 차이
        { wch: 10 }, // 변동률
        { wch: 24 }, // 사유
        { wch: 8 },  // 이상여부
    ]

    XLSX.utils.book_append_sheet(wb, ws1, '전월 대비 비교')

    // ── Sheet 2: 요약 ────────────────────────────────────────
    const summaryData = [
        ['항목', '값'],
        ['대상 월', yearMonth],
        ['총 실수령액 (이번달)', summary.currentTotal],
        ['총 실수령액 (전월)', summary.previousTotal],
        ['변동액', summary.diff],
        ['변동률(%)', summary.diffPercent],
        ['증가 인원', summary.employeesIncreased],
        ['감소 인원', summary.employeesDecreased],
        ['동일 인원', summary.employeesUnchanged],
    ]
    const ws2 = XLSX.utils.aoa_to_sheet(summaryData)
    ws2['!cols'] = [{ wch: 24 }, { wch: 16 }]
    XLSX.utils.book_append_sheet(wb, ws2, '요약')

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

export function generateLedgerExcel(yearMonth: string, rows: LedgerRow[]): ArrayBuffer {
    const wb = XLSX.utils.book_new()

    const headers = [
        '사번', '이름', '부서', '직급',
        '기본급', '연장수당', '야간수당', '휴일수당', '직책수당', '식대', '교통비', '지급합계',
        '국민연금', '건강보험', '장기요양', '고용보험', '소득세', '지방소득세', '공제합계',
        '실수령액',
    ]

    const title = [`${yearMonth} 급여대장`]
    const sheetData = [
        title, [], headers,
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
        ['합계', '', '', '',
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

    XLSX.utils.book_append_sheet(wb, ws, '급여대장')
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

export function generateJournalExcel(yearMonth: string, rows: JournalRow[]): ArrayBuffer {
    const wb = XLSX.utils.book_new()

    // ── Sheet 1: 인건비 전표 ─────────────────────────────────
    const headers = [
        '부서',
        `급여(${ACCOUNT_MAPPING.basePay.code})`,
        `제수당(${ACCOUNT_MAPPING.allowances.code})`,
        `복리후생비(${ACCOUNT_MAPPING.welfare.code})`,
        `법정복리후생비(${ACCOUNT_MAPPING.socialInsurance.code})`,
        `퇴직급여(${ACCOUNT_MAPPING.retirement.code})`,
        '합계',
    ]

    const title = [`${yearMonth} 인건비 전표`]
    const sheetData = [
        title, [], headers,
        ...rows.map((r) => [
            r.department, r.basePay, r.allowances, r.welfare, r.socialInsurance, r.retirement, r.total,
        ]),
        [],
        [
            '합계',
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
    XLSX.utils.book_append_sheet(wb, ws1, '인건비 전표')

    // ── Sheet 2: 계정과목 매핑 ───────────────────────────────
    const mappingData = [
        ['급여항목', '계정코드', '계정명'],
        ...Object.entries(ACCOUNT_MAPPING).map(([, v]) => [v.name, v.code, v.name]),
    ]
    const ws2 = XLSX.utils.aoa_to_sheet(mappingData)
    ws2['!cols'] = [{ wch: 18 }, { wch: 12 }, { wch: 18 }]
    XLSX.utils.book_append_sheet(wb, ws2, '계정과목 매핑')

    return toArrayBuffer(wb)
}

// ─── 파일명 생성 유틸 ─────────────────────────────────────

export function buildExcelFilename(
    companyId: string,
    yearMonth: string,
    type: 'comparison' | 'ledger' | 'journal',
): string {
    const [yr, mn] = yearMonth.split('-')
    const yearLabel = `${yr}년${mn}월`
    const typeMap = { comparison: '전월대비비교', ledger: '급여대장', journal: '인건비전표' }
    return `${companyId}_${yearLabel}_${typeMap[type]}.xlsx`
}

// ─── 타입 re-export (for unused warning suppression) ─────

export { formatKRW, signedKRW, applyHeaderStyle }
