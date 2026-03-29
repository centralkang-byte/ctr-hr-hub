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

export type SimMode = 'SINGLE' | 'BULK' | 'DIFFERENTIAL' | 'COMPA_RATIO' | 'HIRING' | 'FX'
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

// ─── HIRING 채용 시뮬레이션 ─────────────────────────────

export type SalaryAnchor = 'Q1' | 'MID' | 'Q3' | 'CUSTOM'

export interface BandInfo {
    min: number; mid: number; max: number   // 연봉 기준
    q1: number; q3: number                  // Q1 = min+(mid-min)*0.5, Q3 = mid+(max-mid)*0.5
    currency: string
}

export interface PlannedHire {
    gradeCode: string; gradeName: string; headcount: number
    salaryAnchor: SalaryAnchor; monthlySalary: number
    bandInfo?: BandInfo
}

export interface HireGradeBreakdown {
    grade: string; headcount: number; salaryAnchor: SalaryAnchor
    monthlySalaryPerPerson: number; grossPerPerson: number
    deductionsPerPerson: number; netPerPerson: number
    totalMonthlyGross: number; totalMonthlyNet: number
}

export interface RecruitmentCostEstimate {
    costType: string; avgAmount: number; totalForHires: number; currency: string
}

export interface HiringSummary {
    currentMonthlyGross: number; newHireMonthlyGross: number
    projectedMonthlyGross: number; annualAdditionalCost: number
    currentHeadcount: number; newHireCount: number
    byGrade: HireGradeBreakdown[]
    recruitmentCosts?: RecruitmentCostEstimate[]
    currency: string
}

export interface HiringResponse { summary: HiringSummary }

// ─── FX 환율 시뮬레이션 ─────────────────────────────────

export interface FxRateInput {
    currency: string; currentRate: number; adjustedRate: number
}

export interface FxCompanyImpact {
    companyName: string; companyCode: string; currency: string
    employeeCount: number; localMonthlyGross: number
    currentKRW: number; simulatedKRW: number; differenceKRW: number
}

export interface FxSensitivityScenario {
    label: string; rate: number; totalKRW: number; differenceKRW: number
}

export interface FxSensitivityRow {
    currency: string; baseRate: number
    localMonthlyGross: number
    scenarios: FxSensitivityScenario[]
}

export interface FxSummary {
    domesticMonthlyKRW: number
    overseasCurrentKRW: number; overseasSimulatedKRW: number
    totalCurrentKRW: number; totalSimulatedKRW: number; differenceKRW: number
    byCompany: FxCompanyImpact[]
    sensitivity: FxSensitivityRow[]
    baselineRates: Record<string, number>
}

export interface FxResponse { summary: FxSummary }
