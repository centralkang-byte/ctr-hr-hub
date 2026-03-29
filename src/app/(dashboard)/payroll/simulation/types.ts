// Simulation types shared between components

export interface Company { id: string; name: string; code: string; currency: string | null }
export interface Department { id: string; name: string; companyId: string }

export interface PayDetail {
    baseSalary: number; overtimePay: number; nightPay: number; holidayPay: number
    mealAllowance: number; transportAllowance: number; otherAllowance: number; bonusAmount: number
    grossPay: number; nationalPension: number; healthInsurance: number; longTermCare: number
    employmentInsurance: number; incomeTax: number; localIncomeTax: number
    totalDeductions: number; netPay: number
}

export interface EmployeeSimResult {
    id: string; name: string; employeeNo: string; department: string; position: string
    companyCode: string; current: PayDetail; simulated: PayDetail
    difference: { baseSalary: number; grossPay: number; totalDeductions: number; netPay: number }
}

export interface DeptBreakdown {
    department: string; employeeCount: number; currentGross: number
    simulatedGross: number; difference: number
}

export interface SimSummary {
    simulatedAt: string; mode: 'SINGLE' | 'BULK'; employeeCount: number
    parameters: Record<string, unknown>
    totals: {
        currentGross: number; simulatedGross: number; grossDifference: number; grossChangeRate: number
        currentNet: number; simulatedNet: number; netDifference: number; netChangeRate: number
        currentTotalDeductions: number; simulatedTotalDeductions: number
    }
    byDepartment?: DeptBreakdown[]
}

export interface SimResponse { summary: SimSummary; employees: EmployeeSimResult[] }

export interface SearchEmployee {
    id: string; name: string; nameEn: string | null; employeeNo: string
    department: string; position: string; companyCode: string; companyId: string
    currentSalary: number; currency: string
}

export type SimMode = 'SINGLE' | 'BULK' | 'DIFFERENTIAL' | 'COMPA_RATIO'
export type BulkTargetType = 'COMPANY' | 'DEPARTMENT' | 'SELECTED'

// ─── DIFFERENTIAL 모드 ──────────────────────────────────

export interface GradeRate {
    gradeCode: string
    gradeName: string
    rate: number    // -0.5 ~ +0.5
}

export interface BandViolationEmployee {
    name: string
    grade: string
    currentSalary: number
    simulatedSalary: number
    maxSalary: number
    capped: boolean
}

export interface BandViolations {
    count: number
    employees: BandViolationEmployee[]
}

export interface GradeBreakdown {
    grade: string
    employeeCount: number
    currentGross: number
    simulatedGross: number
    difference: number
    rate: number
}

export interface DifferentialSummary extends Omit<SimSummary, 'mode'> {
    mode: 'DIFFERENTIAL'
    byGrade: GradeBreakdown[]
    bandViolations: BandViolations
}

export interface DifferentialResponse {
    summary: DifferentialSummary
    employees: EmployeeSimResult[]
}

// ─── Compa-Ratio 분포 ───────────────────────────────────

export interface CompaRatioDistBucket {
    range: string     // "0.6-0.7", "0.7-0.8", ...
    rangeMin: number
    rangeMax: number
    count: number
}

export interface CompaRatioByGrade {
    grade: string
    avgCompaRatio: number
    employees: number
    minRatio: number
    maxRatio: number
}

export interface CompaRatioByDepartment {
    department: string
    avgCompaRatio: number
    employees: number
}

export interface CompaRatioOutlier {
    id: string
    name: string
    grade: string
    department: string
    compaRatio: number
    salary: number
    currency: string
    bandMin: number
    bandMid: number
    bandMax: number
}

export interface CompaRatioSummary {
    avg: number
    median: number
    belowBand: number   // compaRatio < 0.8
    aboveBand: number   // compaRatio > 1.2
    totalEmployees: number
    coveredEmployees: number  // SalaryBand 있는 직원 수
}

export interface CompaRatioResponse {
    distribution: CompaRatioDistBucket[]
    byGrade: CompaRatioByGrade[]
    byDepartment: CompaRatioByDepartment[]
    outliers: CompaRatioOutlier[]
    summary: CompaRatioSummary
}
