// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/payroll/simulation/export
// 급여 시뮬레이션 결과 Excel 다운로드
// ═══════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { withPermission } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiError } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import * as XLSX from 'xlsx'
import { format } from 'date-fns'

// ─── Excel 생성 유틸 ─────────────────────────────────────

function toArrayBuffer(wb: XLSX.WorkBook): ArrayBuffer {
    const arr = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as number[]
    const uint8 = new Uint8Array(arr)
    return uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength)
}

function fmtNum(n: number): string {
    if (n === 0) return '0'
    return n.toLocaleString('ko-KR')
}

function fmtDiff(n: number): string {
    if (n === 0) return '0'
    return (n > 0 ? '+' : '') + n.toLocaleString('ko-KR')
}

function pctStr(rate: number): string {
    return (rate * 100).toFixed(1) + '%'
}

// ─── Types (matching simulation API response) ────────────

interface PayDetail {
    baseSalary: number
    overtimePay: number
    nightPay: number
    holidayPay: number
    mealAllowance: number
    transportAllowance: number
    otherAllowance: number
    bonusAmount: number
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

interface EmployeeSimResult {
    id: string
    name: string
    employeeNo: string
    department: string
    position: string
    companyCode: string
    current: PayDetail
    simulated: PayDetail
    difference: {
        baseSalary: number
        grossPay: number
        totalDeductions: number
        netPay: number
    }
}

interface SimSummary {
    simulatedAt: string
    mode: 'SINGLE' | 'BULK'
    employeeCount: number
    parameters: Record<string, unknown>
    totals: {
        currentGross: number
        simulatedGross: number
        grossDifference: number
        grossChangeRate: number
        currentNet: number
        simulatedNet: number
        netDifference: number
        netChangeRate: number
        currentTotalDeductions: number
        simulatedTotalDeductions: number
    }
    byDepartment?: Array<{
        department: string
        employeeCount: number
        currentGross: number
        simulatedGross: number
        difference: number
    }>
}

// ─── Excel Build ─────────────────────────────────────────

function buildSimulationExcel(
    summary: SimSummary,
    employees: EmployeeSimResult[],
): ArrayBuffer {
    const wb = XLSX.utils.book_new()
    const t = summary.totals

    // ─── Sheet 1: 요약 ──────────────────────────────────────

    const modeLabel = summary.mode === 'SINGLE' ? '개별' : '일괄'
    const adjRate = (summary.parameters as Record<string, unknown>)?.baseSalaryAdjustRate
    const rateLabel = adjRate !== undefined ? `기본급 인상률: ${((adjRate as number) * 100).toFixed(1)}%` : ''

    const summaryData: (string | number | null)[][] = [
        ['급여 시뮬레이션 보고서'],
        [`생성일: ${format(new Date(summary.simulatedAt), 'yyyy-MM-dd HH:mm')} | 유형: ${modeLabel} | ${rateLabel}`],
        [],
        ['총괄 요약'],
        ['구분', '현재', '시뮬레이션', '차이', '변동률'],
        ['총 지급액', t.currentGross, t.simulatedGross, t.grossDifference, pctStr(t.grossChangeRate)],
        ['총 공제액', t.currentTotalDeductions, t.simulatedTotalDeductions,
            t.simulatedTotalDeductions - t.currentTotalDeductions,
            t.currentTotalDeductions > 0
                ? pctStr((t.simulatedTotalDeductions - t.currentTotalDeductions) / t.currentTotalDeductions)
                : '0.0%',
        ],
        ['총 실수령액', t.currentNet, t.simulatedNet, t.netDifference, pctStr(t.netChangeRate)],
        ['대상 인원', summary.employeeCount, null, null, null],
    ]

    // Department breakdown (bulk)
    if (summary.byDepartment && summary.byDepartment.length > 0) {
        summaryData.push([])
        summaryData.push(['부서별 영향'])
        summaryData.push(['부서', '인원', '현재 총 지급액', '시뮬 총 지급액', '차이', '변동률'] as (string | number | null)[])

        let totalEmpCount = 0
        let totalCurrentGross = 0
        let totalSimGross = 0
        let totalDiff = 0

        for (const dept of summary.byDepartment) {
            const changeRate = dept.currentGross > 0
                ? pctStr(dept.difference / dept.currentGross)
                : '0.0%'

            summaryData.push([
                dept.department,
                dept.employeeCount,
                dept.currentGross,
                dept.simulatedGross,
                dept.difference,
                changeRate,
            ] as (string | number | null)[])

            totalEmpCount += dept.employeeCount
            totalCurrentGross += dept.currentGross
            totalSimGross += dept.simulatedGross
            totalDiff += dept.difference
        }

        summaryData.push([
            '합계',
            totalEmpCount,
            totalCurrentGross,
            totalSimGross,
            totalDiff,
            totalCurrentGross > 0 ? pctStr(totalDiff / totalCurrentGross) : '0.0%',
        ] as (string | number | null)[])
    }

    const ws1 = XLSX.utils.aoa_to_sheet(summaryData)
    ws1['!cols'] = [
        { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 12 },
    ]
    // Merge title
    ws1['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: 4 } },
    ]

    XLSX.utils.book_append_sheet(wb, ws1, '요약')

    // ─── Sheet 2: 직원별 상세 ───────────────────────────────

    const detailHeaders = [
        '사번', '직원명', '부서', '직위',
        '현재 기본급', '시뮬 기본급', '기본급 차이',
        '현재 시간외', '시뮬 시간외',
        '현재 총지급', '시뮬 총지급', '지급 차이',
        '현재 국민연금', '시뮬 국민연금',
        '현재 건강보험', '시뮬 건강보험',
        '현재 장기요양', '시뮬 장기요양',
        '현재 고용보험', '시뮬 고용보험',
        '현재 소득세', '시뮬 소득세',
        '현재 지방소득세', '시뮬 지방소득세',
        '현재 총공제', '시뮬 총공제', '공제 차이',
        '현재 실수령', '시뮬 실수령', '실수령 차이', '변동률',
    ]

    const detailData: (string | number)[][] = [
        ['직원별 시뮬레이션 상세'],
        [`시뮬레이션 일시: ${format(new Date(summary.simulatedAt), 'yyyy-MM-dd HH:mm')} | 대상: ${summary.employeeCount}명`],
        [],
        detailHeaders,
    ]

    let totalCurrentGross = 0
    let totalSimGross = 0
    let totalCurrentNet = 0
    let totalSimNet = 0
    let totalCurrentDed = 0
    let totalSimDed = 0

    for (const emp of employees) {
        const c = emp.current
        const s = emp.simulated
        const netChangeRate = c.netPay > 0
            ? pctStr((s.netPay - c.netPay) / c.netPay)
            : '0.0%'

        detailData.push([
            emp.employeeNo,
            emp.name,
            emp.department,
            emp.position,
            c.baseSalary, s.baseSalary, s.baseSalary - c.baseSalary,
            c.overtimePay, s.overtimePay,
            c.grossPay, s.grossPay, s.grossPay - c.grossPay,
            c.nationalPension, s.nationalPension,
            c.healthInsurance, s.healthInsurance,
            c.longTermCare, s.longTermCare,
            c.employmentInsurance, s.employmentInsurance,
            c.incomeTax, s.incomeTax,
            c.localIncomeTax, s.localIncomeTax,
            c.totalDeductions, s.totalDeductions, s.totalDeductions - c.totalDeductions,
            c.netPay, s.netPay, s.netPay - c.netPay,
            netChangeRate,
        ])

        totalCurrentGross += c.grossPay
        totalSimGross += s.grossPay
        totalCurrentNet += c.netPay
        totalSimNet += s.netPay
        totalCurrentDed += c.totalDeductions
        totalSimDed += s.totalDeductions
    }

    // 합계 행
    detailData.push([])
    detailData.push([
        '', '합계', '', '',
        employees.reduce((s, e) => s + e.current.baseSalary, 0),
        employees.reduce((s, e) => s + e.simulated.baseSalary, 0),
        employees.reduce((s, e) => s + e.difference.baseSalary, 0),
        employees.reduce((s, e) => s + e.current.overtimePay, 0),
        employees.reduce((s, e) => s + e.simulated.overtimePay, 0),
        totalCurrentGross, totalSimGross, totalSimGross - totalCurrentGross,
        employees.reduce((s, e) => s + e.current.nationalPension, 0),
        employees.reduce((s, e) => s + e.simulated.nationalPension, 0),
        employees.reduce((s, e) => s + e.current.healthInsurance, 0),
        employees.reduce((s, e) => s + e.simulated.healthInsurance, 0),
        employees.reduce((s, e) => s + e.current.longTermCare, 0),
        employees.reduce((s, e) => s + e.simulated.longTermCare, 0),
        employees.reduce((s, e) => s + e.current.employmentInsurance, 0),
        employees.reduce((s, e) => s + e.simulated.employmentInsurance, 0),
        employees.reduce((s, e) => s + e.current.incomeTax, 0),
        employees.reduce((s, e) => s + e.simulated.incomeTax, 0),
        employees.reduce((s, e) => s + e.current.localIncomeTax, 0),
        employees.reduce((s, e) => s + e.simulated.localIncomeTax, 0),
        totalCurrentDed, totalSimDed, totalSimDed - totalCurrentDed,
        totalCurrentNet, totalSimNet, totalSimNet - totalCurrentNet,
        totalCurrentNet > 0 ? pctStr((totalSimNet - totalCurrentNet) / totalCurrentNet) : '0.0%',
    ])

    const ws2 = XLSX.utils.aoa_to_sheet(detailData)

    // Column widths
    ws2['!cols'] = detailHeaders.map((h) => ({
        wch: Math.max(h.length + 2, 14),
    }))

    // Freeze row 4 (0-indexed: ySplit)
    ws2['!freeze'] = { xSplit: 0, ySplit: 4, topLeftCell: 'A5' }

    XLSX.utils.book_append_sheet(wb, ws2, '직원별 상세')

    return toArrayBuffer(wb)
}

// ─── Route Handler ───────────────────────────────────────

export const POST = withRateLimit(withPermission(
    async (req: NextRequest) => {
        const body = await req.json()

        // Re-run simulation internally to get fresh data
        const simRes = await fetch(new URL('/api/v1/payroll/simulation', req.url), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                cookie: req.headers.get('cookie') ?? '',
            },
            body: JSON.stringify(body),
        })

        if (!simRes.ok) {
            const errBody = await simRes.json().catch(() => ({}))
            return apiError(badRequest((errBody as Record<string, Record<string, string>>)?.error?.message ?? '시뮬레이션 실패'))
        }

        const simData = await simRes.json() as {
            data: {
                summary: SimSummary
                employees: EmployeeSimResult[]
            }
        }

        const { summary, employees } = simData.data

        // Build Excel
        const buffer = buildSimulationExcel(summary, employees)
        const filename = `CTR_급여시뮬레이션_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`

        // Binary file response — EXCEPTION to apiSuccess pattern
        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
            },
        })
    },
    { module: MODULE.PAYROLL, action: ACTION.EXPORT },
), RATE_LIMITS.EXPORT)
