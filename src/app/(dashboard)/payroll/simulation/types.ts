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

export type SimMode = 'SINGLE' | 'BULK'
export type BulkTargetType = 'COMPANY' | 'DEPARTMENT' | 'SELECTED'
