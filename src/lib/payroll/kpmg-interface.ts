// KPMG 급여 연동 인터페이스 — STEP 2.5
// CTR Europe (폴란드) — KPMG 외주 급여 처리
// Phase 2에서 구현. 여기서는 인터페이스만 정의.

export interface KpmgPayrollImport {
  employee_no: string
  period_start: string // YYYY-MM-DD
  period_end: string
  gross_salary: number
  zus_employer: number // 사회보험 고용주분
  zus_employee: number // 사회보험 직원분
  ppk_employer: number // PPK 고용주분
  ppk_employee: number // PPK 직원분
  pit_tax: number // 소득세
  net_salary: number
  currency: 'PLN'
}

export interface KpmgImportResult {
  total_records: number
  successful: number
  failed: number
  errors: Array<{ employee_no: string; reason: string }>
}

// 예상 연동 방식: Excel/CSV 업로드 → 파싱 → payroll_items INSERT
// Phase 2에서 구현
export function parseKpmgExcel(_fileBuffer: Buffer): KpmgPayrollImport[] {
  throw new Error('KPMG Excel 파싱은 Phase 2에서 구현됩니다.')
}
