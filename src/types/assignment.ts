// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Employee Assignment 타입 정의
// A2-1: Effective Dating 기반 인사 변동 이력
// ═══════════════════════════════════════════════════════════

export type ChangeType =
  | 'HIRE'             // 입사
  | 'TRANSFER'         // 부서 이동
  | 'PROMOTION'        // 승진
  | 'DEMOTION'         // 강등
  | 'REORGANIZATION'   // 조직 개편
  | 'STATUS_CHANGE'    // 상태 변경 (재직↔휴직 등)
  | 'CONTRACT_CHANGE'  // 계약 유형 변경
  | 'COMPANY_TRANSFER' // 법인 전환

export type EmployeeAssignment = {
  id:             string
  employeeId:     string
  effectiveDate:  string // YYYY-MM-DD
  endDate:        string | null
  changeType:     ChangeType
  companyId:      string
  departmentId:   string | null
  jobGradeId:     string | null
  jobCategoryId:  string | null
  employmentType: string // EmploymentType enum 값
  contractType:   string | null // ContractType enum 값
  status:         string // EmployeeStatus enum 값
  positionId:     string | null // A2-2에서 FK 설정
  isPrimary:      boolean
  reason:         string | null
  orderNumber:    string | null
  approvedBy:     string | null
  createdAt:      string
  updatedAt:      string
}

export type EmployeeAssignmentWithRelations = EmployeeAssignment & {
  company: {
    id:   string
    code: string
    name: string
  }
  department?: {
    id:   string
    name: string
  } | null
  jobGrade?: {
    id:        string
    code:      string
    name:      string
    rankOrder: number
  } | null
  jobCategory?: {
    id:   string
    name: string
  } | null
  approver?: {
    id:       string
    name:     string
    photoUrl: string | null
  } | null
}

export type CreateAssignmentParams = {
  employeeId:     string
  effectiveDate:  Date | string
  changeType:     ChangeType
  companyId:      string
  departmentId?:  string
  jobGradeId?:    string
  jobCategoryId?: string
  employmentType: string
  contractType?:  string
  status:         string
  positionId?:    string
  isPrimary?:     boolean
  reason?:        string
  orderNumber?:   string
  approvedBy?:    string
}

// current_employee_view에서 반환되는 타입 (기존 Employee 호환)
export type CurrentEmployeeView = {
  id:                      string
  employee_no:             string
  name:                    string
  name_en:                 string | null
  birth_date:              string | null
  gender:                  string | null
  nationality:             string | null
  email:                   string
  phone:                   string | null
  emergency_contact:       string | null
  emergency_contact_phone: string | null
  hire_date:               string
  resign_date:             string | null
  photo_url:               string | null
  locale:                  string | null
  timezone:                string | null
  attrition_risk_score:    number
  is_high_potential:       boolean
  high_potential_since:    string | null
  onboarded_at:            string | null
  created_at:              string
  updated_at:              string
  deleted_at:              string | null
  contract_number:         number
  contract_start_date:     string | null
  contract_end_date:       string | null
  contract_auto_convert_date: string | null
  probation_start_date:    string | null
  probation_end_date:      string | null
  probation_status:        string
  // assignment 필드
  company_id:      string | null
  department_id:   string | null
  job_grade_id:    string | null
  job_category_id: string | null
  employment_type: string | null
  contract_type:   string | null
  status:          string | null
  position_id:     string | null
  is_primary:      boolean | null
  assignment_id:   string | null
  effective_date:  string | null
  change_type:     string | null
}
