# Phase A2-1: Core HR 데이터 모델 변경 — 스키마 + 데이터 이관 + 뷰

## 참조 문서 (세션 시작 시 반드시 읽기)
- `CLAUDE.md` §6 RBAC 구조 — 역할/권한 체계
- `CTR_UI_PATTERNS.md` — 변경 없음 (이번 세션은 스키마 작업)
- `context.md` — 현재 프로젝트 상태
- `prisma/schema.prisma` — 현재 데이터 모델 전체 확인 필수

---

## 미션
Employee 모델에서 인사 변동 필드 8개를 `employee_assignments` 테이블로 분리하고,
기존 코드 호환을 위한 `current_employee_view`를 생성한다.
이번 세션은 **스키마 변경 + 데이터 이관 + 뷰 + 헬퍼 함수**만 수행한다.
API/페이지 수정은 A2-3에서 처리한다.

---

## 현재 상태 (AS-IS)

### Employee 모델에서 분리 대상 필드 (8개)
```
departmentId      — 부서 이동 시 변경
jobGradeId        — 승진/강등 시 변경
jobCategoryId     — 직군 변경 시 변경
managerId         — 보고라인 변경 (→ A2-2에서 Position 기반으로 전환)
companyId         — 법인 전환
employmentType    — 정규↔계약 전환
contractType      — 계약 유형 변경
status            — 재직/휴직/퇴직
```

### Employee 모델에서 유지하는 필드 (불변/개인정보)
```
id, employeeNumber, name, email, phone, dateOfBirth, gender,
nationality, address, profileImageUrl, hireDate, terminationDate,
attritionRiskScore, isHighPotential, emergencyContact,
createdAt, updatedAt
```

### 기존 이력 모델 (5개 — 건드리지 않음)
```
EmployeeHistory       — 부서/직급/법인 변경 감사 로그 (보존)
CompensationHistory   — 급여 변경 이력 (보존)
ContractHistory       — 계약 이력 (보존)
OrgChangeHistory      — 조직 변경 이력 (보존)
EntityTransfer        — 법인 전환 이력 (보존)
```

### 영향 범위
- 42개 API 라우트가 employees 참조 (102 occurrences)
- 이번 세션에서 API는 수정하지 않음 — 뷰로 호환성 확보

---

## 목표 상태 (TO-BE)

### 1. employee_assignments 테이블 (신규)

```sql
CREATE TABLE employee_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  
  -- Effective Dating
  effective_date  DATE NOT NULL,
  end_date        DATE,                -- NULL = 현재 유효
  
  -- 변경 유형
  change_type     TEXT NOT NULL,       -- ENUM: HIRE, TRANSFER, PROMOTION, DEMOTION,
                                       --       REORGANIZATION, STATUS_CHANGE, 
                                       --       CONTRACT_CHANGE, COMPANY_TRANSFER
  
  -- Employee에서 분리된 8개 필드
  company_id      UUID NOT NULL REFERENCES companies(id),
  department_id   UUID REFERENCES departments(id),
  job_grade_id    UUID REFERENCES job_grades(id),
  job_category_id UUID REFERENCES job_categories(id),
  employment_type TEXT NOT NULL,        -- 기존 EmploymentType enum 재사용
  contract_type   TEXT,                 -- 기존 ContractType enum 재사용
  status          TEXT NOT NULL,        -- 기존 EmployeeStatus enum 재사용
  
  -- Position 연결 (A2-2에서 추가, 지금은 nullable)
  position_id     UUID,                 -- A2-2에서 FK 설정
  is_primary      BOOLEAN NOT NULL DEFAULT true,  -- 매트릭스 조직: primary/secondary
  
  -- 메타데이터
  reason          TEXT,                 -- 변경 사유
  order_number    TEXT,                 -- 발령번호
  approved_by     UUID REFERENCES employees(id),
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- 제약조건: 한 직원의 primary assignment는 동시에 1개만 유효
  -- (end_date IS NULL AND is_primary = true인 레코드가 1개)
  CONSTRAINT unique_primary_assignment 
    UNIQUE (employee_id, is_primary, end_date) 
    WHERE (is_primary = true AND end_date IS NULL)
);

-- 인덱스
CREATE INDEX idx_assignments_employee ON employee_assignments(employee_id);
CREATE INDEX idx_assignments_effective ON employee_assignments(effective_date);
CREATE INDEX idx_assignments_current ON employee_assignments(employee_id) 
  WHERE end_date IS NULL;
CREATE INDEX idx_assignments_company ON employee_assignments(company_id);
CREATE INDEX idx_assignments_department ON employee_assignments(department_id);
```

### 2. employees 테이블 변경

```sql
-- 8개 필드 제거
ALTER TABLE employees 
  DROP COLUMN department_id,
  DROP COLUMN job_grade_id,
  DROP COLUMN job_category_id,
  DROP COLUMN manager_id,
  DROP COLUMN company_id,
  DROP COLUMN employment_type,
  DROP COLUMN contract_type,
  DROP COLUMN status;
```

> ⚠️ 반드시 데이터 이관 후에 DROP 실행

### 3. current_employee_view (호환성 뷰)

```sql
CREATE OR REPLACE VIEW current_employee_view AS
SELECT 
  e.id,
  e.employee_number,
  e.name,
  e.email,
  e.phone,
  e.date_of_birth,
  e.gender,
  e.nationality,
  e.address,
  e.profile_image_url,
  e.hire_date,
  e.termination_date,
  e.attrition_risk_score,
  e.is_high_potential,
  e.emergency_contact,
  e.created_at,
  e.updated_at,
  -- assignment에서 가져오는 필드
  a.company_id,
  a.department_id,
  a.job_grade_id,
  a.job_category_id,
  a.employment_type,
  a.contract_type,
  a.status,
  a.position_id,
  a.is_primary
FROM employees e
LEFT JOIN employee_assignments a 
  ON a.employee_id = e.id 
  AND a.end_date IS NULL 
  AND a.is_primary = true;
```

> 이 뷰는 기존 employees 테이블과 **동일한 shape**을 반환한다.
> 42개 API에서 `employees` → `current_employee_view`로 참조만 바꾸면 기존 동작 유지.

### 4. 데이터 이관 스크립트

```sql
-- 1) 기존 Employee 데이터 → employee_assignments로 이관
INSERT INTO employee_assignments (
  employee_id, effective_date, end_date, change_type,
  company_id, department_id, job_grade_id, job_category_id,
  employment_type, contract_type, status, is_primary, reason
)
SELECT 
  id,
  COALESCE(hire_date, created_at::date),  -- effective_date = 입사일
  NULL,                                     -- 현재 유효
  'HIRE',                                   -- 초기 레코드
  company_id,
  department_id,
  job_grade_id,
  job_category_id,
  employment_type,
  contract_type,
  status,
  true,                                     -- primary
  '데이터 마이그레이션: 초기 레코드'
FROM employees
WHERE company_id IS NOT NULL;               -- 유효한 레코드만

-- 2) 이관 검증
-- 이관 전 employees 수 == 이관 후 assignments 수 확인
-- SELECT COUNT(*) FROM employees WHERE company_id IS NOT NULL;
-- SELECT COUNT(*) FROM employee_assignments;

-- 3) 검증 통과 후 employees에서 필드 제거
-- ALTER TABLE employees DROP COLUMN ...
```

---

## 구현 명세

### 작업 범위 (이번 세션)
1. ✅ employee_assignments 테이블 생성 (Prisma 스키마 + 마이그레이션)
2. ✅ 데이터 이관 스크립트 실행
3. ✅ employees 테이블에서 8개 필드 제거
4. ✅ current_employee_view 생성
5. ✅ 공통 헬퍼 함수 작성
6. ❌ Position/Job 테이블 (A2-2)
7. ❌ company_process_settings (A2-2)
8. ❌ API 수정 (A2-3)

### 파일 변경 계획

#### 신규 생성
```
prisma/migrations/YYYYMMDD_employee_assignments/migration.sql
src/lib/assignments.ts              — assignment 헬퍼 함수
src/types/assignment.ts             — 타입 정의
```

#### 수정
```
prisma/schema.prisma                — Employee 모델 변경 + EmployeeAssignment 추가
```

#### 참조 (읽기만)
```
src/lib/constants.ts                — 기존 enum 값 확인
src/types/index.ts                  — 기존 타입 확인
```

### 헬퍼 함수 (`src/lib/assignments.ts`)

```typescript
import { supabase } from '@/lib/supabase';

// ── 현재 유효한 assignment 조회 ──
export async function getCurrentAssignment(employeeId: string) {
  const { data } = await supabase
    .from('employee_assignments')
    .select('*, department:departments(*), jobGrade:job_grades(*), company:companies(*)')
    .eq('employee_id', employeeId)
    .eq('is_primary', true)
    .is('end_date', null)
    .single();
  return data;
}

// ── 특정 시점의 assignment 조회 (Effective Dating 핵심) ──
export async function getAssignmentAtDate(employeeId: string, targetDate: string) {
  const { data } = await supabase
    .from('employee_assignments')
    .select('*, department:departments(*), jobGrade:job_grades(*), company:companies(*)')
    .eq('employee_id', employeeId)
    .eq('is_primary', true)
    .lte('effective_date', targetDate)
    .or(`end_date.is.null,end_date.gt.${targetDate}`)
    .single();
  return data;
}

// ── 새 assignment 생성 (이전 레코드 자동 종료) ──
export async function createAssignment(params: {
  employeeId: string;
  effectiveDate: string;
  changeType: ChangeType;
  companyId: string;
  departmentId?: string;
  jobGradeId?: string;
  jobCategoryId?: string;
  employmentType: string;
  contractType?: string;
  status: string;
  positionId?: string;
  isPrimary?: boolean;
  reason?: string;
  orderNumber?: string;
  approvedBy?: string;
}) {
  const { employeeId, effectiveDate, isPrimary = true, ...rest } = params;
  
  // 1. 기존 현재 assignment 종료
  if (isPrimary) {
    await supabase
      .from('employee_assignments')
      .update({ end_date: effectiveDate })
      .eq('employee_id', employeeId)
      .eq('is_primary', true)
      .is('end_date', null);
  }
  
  // 2. 새 assignment 생성
  const { data, error } = await supabase
    .from('employee_assignments')
    .insert({
      employee_id: employeeId,
      effective_date: effectiveDate,
      is_primary: isPrimary,
      ...rest,
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// ── 직원의 assignment 이력 조회 ──
export async function getAssignmentHistory(employeeId: string) {
  const { data } = await supabase
    .from('employee_assignments')
    .select('*, department:departments(*), jobGrade:job_grades(*), company:companies(*)')
    .eq('employee_id', employeeId)
    .order('effective_date', { ascending: false });
  return data;
}

// ── 매니저 조회 (Position 기반 — A2-2 이후 활성화) ──
// export async function getManagerByPosition(employeeId: string) {
//   // 내 position → reports_to_position_id → 그 position에 앉은 사람
//   // A2-2에서 Position 테이블 생성 후 구현
// }

// ── 부서별 현재 인원 조회 ──
export async function getEmployeesByDepartment(departmentId: string) {
  const { data } = await supabase
    .from('employee_assignments')
    .select('*, employee:employees(*)')
    .eq('department_id', departmentId)
    .eq('is_primary', true)
    .is('end_date', null);
  return data;
}
```

### 타입 정의 (`src/types/assignment.ts`)

```typescript
export type ChangeType = 
  | 'HIRE'
  | 'TRANSFER'
  | 'PROMOTION'
  | 'DEMOTION'
  | 'REORGANIZATION'
  | 'STATUS_CHANGE'
  | 'CONTRACT_CHANGE'
  | 'COMPANY_TRANSFER';

export type EmployeeAssignment = {
  id: string;
  employeeId: string;
  effectiveDate: string;
  endDate: string | null;
  changeType: ChangeType;
  companyId: string;
  departmentId: string | null;
  jobGradeId: string | null;
  jobCategoryId: string | null;
  employmentType: string;
  contractType: string | null;
  status: string;
  positionId: string | null;
  isPrimary: boolean;
  reason: string | null;
  orderNumber: string | null;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
};
```

---

## 실행 순서

```
1. prisma/schema.prisma 확인 — Employee 모델 현재 상태 파악
2. EmployeeAssignment 모델 추가 (Prisma)
3. 마이그레이션 SQL 생성 (employee_assignments 테이블)
4. 데이터 이관 스크립트 실행 (employees → employee_assignments)
5. 이관 검증 (레코드 수 일치 확인)
6. employees에서 8개 필드 제거 (Prisma + 마이그레이션)
7. current_employee_view 생성 (SQL 마이그레이션)
8. src/lib/assignments.ts 생성 (헬퍼 함수)
9. src/types/assignment.ts 생성 (타입)
10. Prisma generate (npx prisma generate)
11. 빌드 시도 (npm run build) — 에러 목록 확인만, 수정은 A2-3
```

> ⚠️ 단계 11에서 빌드 에러가 발생하는 것은 예상된 동작.
> employees에서 제거한 필드를 참조하는 42개 API가 에러를 낼 것.
> 에러 목록을 기록해두되, 수정은 A2-3에서 수행.

---

## 주의사항

1. **데이터 이관 전 반드시 백업**: 이관 스크립트 실행 전 현재 employees 데이터 백업
2. **이관 검증 필수**: `SELECT COUNT(*)` 비교로 레코드 수 일치 확인
3. **기존 EmployeeHistory 건드리지 않음**: 감사 로그로 보존
4. **manager_id 처리**: 이번 세션에서 employee_assignments에는 manager_id를 넣지 않음. A2-2에서 Position.reports_to_position_id로 대체. 단, 기존 manager_id 데이터는 별도 임시 컬럼이나 매핑 테이블에 보존하여 A2-2에서 Position 보고라인 시드 데이터로 활용
5. **position_id는 nullable**: A2-2에서 Position 테이블 생성 후 FK 설정 + 데이터 연결
6. **current_employee_view 필드명**: 기존 employees 테이블과 동일한 컬럼명 유지 (camelCase → snake_case 변환 주의)
7. **Supabase 뷰 + RLS**: 뷰에는 직접 RLS가 안 걸림. `security_invoker = true` 설정 또는 API 레이어 권한 체크 유지

---

## 빌드 에러 기록 양식

```markdown
## A2-1 빌드 에러 목록 (A2-3에서 수정)

| # | 파일 경로 | 에러 내용 | 수정 방향 |
|---|----------|----------|----------|
| 1 | src/app/api/v1/employees/route.ts | departmentId not found | current_employee_view 참조로 전환 |
| 2 | ... | ... | ... |
```

> 이 목록을 context.md에 기록하여 A2-3 세션에 전달

---

## 완료 기준

- [ ] employee_assignments 테이블 생성 완료
- [ ] 기존 employees 데이터 → assignments 이관 완료 (레코드 수 일치)
- [ ] employees에서 8개 필드 제거 완료
- [ ] current_employee_view 생성 완료
- [ ] `SELECT * FROM current_employee_view LIMIT 5` 정상 반환
- [ ] src/lib/assignments.ts 헬퍼 함수 작성 완료
- [ ] src/types/assignment.ts 타입 작성 완료
- [ ] `npx prisma generate` 성공
- [ ] 빌드 에러 목록 기록 완료 (A2-3 전달용)
- [ ] manager_id 데이터 보존 확인 (A2-2 전달용)
- [ ] context.md 업데이트 완료

---

## 세션 마무리 (반드시 실행)

### context.md 업데이트
세션 완료 후 `context.md`에 아래 내용을 반영한다:

1. **리팩토링 마스터플랜 진행 현황** — A2-1 상태를 `✅ 완료`로 변경
2. **A2-1 작업 결과 섹션 추가:**
   - 생성/변경된 파일 목록
   - employee_assignments 레코드 수
   - 이관 검증 결과
   - 빌드 에러 목록 (A2-3 전달용)
   - manager_id 보존 위치 (A2-2 전달용)
3. **다음 작업** — A2-2 상태를 `🔄 다음 실행 대기`로 변경
