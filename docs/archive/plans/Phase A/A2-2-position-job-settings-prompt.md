# Phase A2-2: Position/Job 모델 + company_process_settings + 매트릭스 조직

## 참조 문서 (세션 시작 시 반드시 읽기)
- `CLAUDE.md` §6 RBAC 구조 — 역할/권한 체계
- `context.md` — A2-1 작업 결과 + manager_id 보존 위치 확인
- `prisma/schema.prisma` — A2-1 이후 상태 확인
- `src/lib/assignments.ts` — A2-1에서 만든 헬퍼 함수 확인

---

## 미션
Position(직위) + Job(직무) 모델을 도입하고, 자리 기반 보고라인으로 전환하며,
법인별 설정의 기반 테이블(company_process_settings)을 생성한다.

---

## 전제 조건 (A2-1 완료 상태)
- ✅ employee_assignments 테이블 생성 완료
- ✅ employees에서 8개 필드 제거 완료
- ✅ current_employee_view 생성 완료
- ✅ manager_id 데이터 보존 (임시 테이블 또는 매핑)
- ⚠️ 빌드 에러 상태 (42개 API — A2-3에서 수정)

---

## 작업 1: Job 모델 (신규)

### 테이블 설계

```sql
CREATE TABLE jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID REFERENCES companies(id),  -- NULL = 글로벌 공통 직무
  job_category_id UUID REFERENCES job_categories(id),
  code            TEXT NOT NULL,                    -- 예: "SWE", "HR-BP", "MFG-OP"
  title           TEXT NOT NULL,                    -- 예: "소프트웨어 엔지니어"
  description     TEXT,
  min_grade_id    UUID REFERENCES job_grades(id),   -- 이 직무의 최소 직급
  max_grade_id    UUID REFERENCES job_grades(id),   -- 이 직무의 최대 직급
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_job_code UNIQUE (company_id, code)
);

CREATE INDEX idx_jobs_company ON jobs(company_id);
CREATE INDEX idx_jobs_category ON jobs(job_category_id);
```

### 시드 데이터 구조

CTR은 자동차부품 제조사이므로 생산직/사무직/연구직이 혼재한다.

```
글로벌 공통 직무 (company_id = NULL):
├── 경영/관리: CEO, CFO, CHO, COO, 법인장
├── HR: HR 비즈니스 파트너, HR 운영, 채용 담당, 보상/복리후생 담당, 교육 담당
├── 재무: 회계, 재무 분석, 세무
├── IT: 소프트웨어 엔지니어, 시스템 관리자, DBA
└── 공통: 총무, 법무, 구매

제조 직무 (법인별):
├── 생산: 생산 오퍼레이터, 생산 라인 리더, 생산 관리자, 품질 검사원
├── 품질: 품질 엔지니어, 품질 관리자, SQA
├── 설비: 설비 엔지니어, 설비 보전, 금형 기술자
└── 물류: 물류 담당, 창고 관리, SCM

R&D 직무 (주로 KR/CN):
├── 연구: 연구원, 선임 연구원, 수석 연구원
├── 설계: CAD 설계, 해석 엔지니어, 시험 엔지니어
└── 개발: 제품 개발, 공정 개발
```

> 시드 데이터는 글로벌 공통 15~20개 + 법인별 10~15개 수준으로 생성.
> 모든 법인에 동일 제조 직무가 있되, 법인별 특수 직무(예: CTR-RU 군복무 관련)는 별도.

---

## 작업 2: Position 모델 (신규)

### 테이블 설계

```sql
CREATE TABLE positions (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id                UUID NOT NULL REFERENCES companies(id),
  department_id             UUID NOT NULL REFERENCES departments(id),
  job_id                    UUID NOT NULL REFERENCES jobs(id),
  job_grade_id              UUID REFERENCES job_grades(id),
  
  code                      TEXT NOT NULL,          -- 예: "KR-DEV-TL-001"
  title                     TEXT NOT NULL,          -- 예: "개발팀 팀장"
  headcount                 INT NOT NULL DEFAULT 1, -- 정원
  
  -- 보고라인 (자리 기반)
  reports_to_position_id    UUID REFERENCES positions(id),  -- solid-line
  dotted_line_position_id   UUID REFERENCES positions(id),  -- dotted-line (매트릭스)
  
  -- 상태
  status                    TEXT NOT NULL DEFAULT 'ACTIVE',
                            -- ACTIVE: 운영 중
                            -- FROZEN: 동결 (충원 불가)
                            -- ABOLISHED: 폐지
  
  -- 승계/채용 연결
  is_key_position           BOOLEAN NOT NULL DEFAULT false,  -- 핵심직책 (B3 승계계획 연결)
  
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_position_code UNIQUE (company_id, code)
);

CREATE INDEX idx_positions_company ON positions(company_id);
CREATE INDEX idx_positions_department ON positions(department_id);
CREATE INDEX idx_positions_job ON positions(job_id);
CREATE INDEX idx_positions_reports_to ON positions(reports_to_position_id);
CREATE INDEX idx_positions_status ON positions(status) WHERE status = 'ACTIVE';
```

### Position 코드 규칙

```
{법인코드}-{부서약어}-{직급약어}-{순번}
예: KR-DEV-TL-001   (한국-개발팀-팀장-1번)
    CN-MFG-OP-003   (중국-생산팀-오퍼레이터-3번)
    US-HR-MGR-001   (미국-인사팀-매니저-1번)
```

### employee_assignments 연결

```sql
-- A2-1에서 nullable로 만든 position_id에 FK 설정
ALTER TABLE employee_assignments 
  ADD CONSTRAINT fk_assignment_position 
  FOREIGN KEY (position_id) REFERENCES positions(id);

CREATE INDEX idx_assignments_position ON employee_assignments(position_id);
```

### 현원/공석 계산 쿼리

```sql
-- Position별 현원/공석
SELECT 
  p.id,
  p.title,
  p.headcount AS 정원,
  COUNT(a.id) AS 현원,
  p.headcount - COUNT(a.id) AS 공석
FROM positions p
LEFT JOIN employee_assignments a 
  ON a.position_id = p.id 
  AND a.end_date IS NULL 
  AND a.is_primary = true
WHERE p.status = 'ACTIVE'
GROUP BY p.id;
```

### 시드 데이터 규모

6개 법인 × 부서별 포지션 = 약 200~300개 Position 시드 예상.

```
CTR-KR (약 80~100개):
├── 경영진: 대표이사, 부사장, 전무 등 (5~8)
├── 개발팀: 팀장 1, 과장 3, 대리 5, 사원 8 등 (15~20)
├── 생산팀: 팀장 1, 라인리더 3, 오퍼레이터 20 등 (25~30)
├── 품질팀, HR팀, 재무팀, 구매팀 등 (각 5~15)
└── ...

CTR-CN (약 50~70개):
├── 법인장 1
├── 생산/품질 위주 (30~40)
└── 지원부서 (10~20)

CTR-RU, CTR-US, CTR-VN, CTR-MX (각 20~40개)
```

> 시드는 핵심 포지션 위주로 생성. 모든 슬롯을 채울 필요 없음.

---

## 작업 3: 보고라인 전환 (manager_id → Position 기반)

### 매니저 조회 헬퍼 함수

```typescript
// src/lib/assignments.ts에 추가

// ── 매니저 조회 (Position 기반) ──
export async function getManagerByPosition(employeeId: string) {
  // 1. 내 현재 primary assignment → position_id
  const myAssignment = await getCurrentAssignment(employeeId);
  if (!myAssignment?.position_id) return null;
  
  // 2. 내 position → reports_to_position_id
  const { data: myPosition } = await supabase
    .from('positions')
    .select('reports_to_position_id')
    .eq('id', myAssignment.position_id)
    .single();
  if (!myPosition?.reports_to_position_id) return null;
  
  // 3. reports_to position에 앉은 사람
  const { data: managerAssignment } = await supabase
    .from('employee_assignments')
    .select('*, employee:employees(*)')
    .eq('position_id', myPosition.reports_to_position_id)
    .eq('is_primary', true)
    .is('end_date', null)
    .single();
  
  return managerAssignment?.employee || null;
}

// ── 직속 부하 조회 (Position 기반) ──
export async function getDirectReports(employeeId: string) {
  // 1. 내 현재 position_id
  const myAssignment = await getCurrentAssignment(employeeId);
  if (!myAssignment?.position_id) return [];
  
  // 2. reports_to_position_id가 내 position인 positions
  const { data: subordinatePositions } = await supabase
    .from('positions')
    .select('id')
    .eq('reports_to_position_id', myAssignment.position_id)
    .eq('status', 'ACTIVE');
  
  if (!subordinatePositions?.length) return [];
  
  // 3. 해당 positions에 앉은 사람들
  const positionIds = subordinatePositions.map(p => p.id);
  const { data: assignments } = await supabase
    .from('employee_assignments')
    .select('*, employee:employees(*)')
    .in('position_id', positionIds)
    .eq('is_primary', true)
    .is('end_date', null);
  
  return assignments?.map(a => a.employee) || [];
}

// ── Dotted-line 매니저 조회 ──
export async function getDottedLineManager(employeeId: string) {
  const myAssignment = await getCurrentAssignment(employeeId);
  if (!myAssignment?.position_id) return null;
  
  const { data: myPosition } = await supabase
    .from('positions')
    .select('dotted_line_position_id')
    .eq('id', myAssignment.position_id)
    .single();
  if (!myPosition?.dotted_line_position_id) return null;
  
  const { data: dottedAssignment } = await supabase
    .from('employee_assignments')
    .select('*, employee:employees(*)')
    .eq('position_id', myPosition.dotted_line_position_id)
    .eq('is_primary', true)
    .is('end_date', null)
    .single();
  
  return dottedAssignment?.employee || null;
}
```

### manager_id 데이터 → Position 보고라인 매핑

A2-1에서 보존한 기존 manager_id 데이터를 활용하여 Position의 `reports_to_position_id`를 설정한다:

```sql
-- 기존 manager_id → position 보고라인 매핑 전략:
-- 1. 각 직원의 기존 manager_id를 참조
-- 2. 해당 매니저가 앉은 position을 찾음
-- 3. 내 position의 reports_to_position_id를 매니저의 position으로 설정

-- 시드 데이터 생성 시 부서별 최상위 → 하위 순으로 보고라인 설정:
-- 대표이사(Position) 
--   → 본부장들(reports_to = 대표이사 Position)
--     → 팀장들(reports_to = 본부장 Position)
--       → 팀원들(reports_to = 팀장 Position)
```

> 완벽한 자동 매핑이 어려우면, 핵심 보고라인(경영진 → 팀장 레벨)만 시드에서 설정하고
> 나머지는 부서 내 최상위 직급자를 기본 reports_to로 설정한다.

---

## 작업 4: current_employee_view 업데이트

Position/Job 추가로 뷰를 확장한다:

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
  -- assignment 필드
  a.company_id,
  a.department_id,
  a.job_grade_id,
  a.job_category_id,
  a.employment_type,
  a.contract_type,
  a.status,
  a.position_id,
  a.is_primary,
  -- Position/Job 조인 (신규)
  p.title AS position_title,
  p.code AS position_code,
  p.reports_to_position_id,
  p.dotted_line_position_id,
  p.headcount AS position_headcount,
  p.is_key_position,
  j.id AS job_id,
  j.title AS job_title,
  j.code AS job_code,
  -- 매니저 정보 (Position 기반 역참조)
  mgr_a.employee_id AS manager_id,
  mgr_e.name AS manager_name
FROM employees e
LEFT JOIN employee_assignments a 
  ON a.employee_id = e.id 
  AND a.end_date IS NULL 
  AND a.is_primary = true
LEFT JOIN positions p
  ON p.id = a.position_id
LEFT JOIN jobs j
  ON j.id = p.job_id
-- 매니저 역참조: 내 Position → reports_to Position → 그 Position의 현재 사람
LEFT JOIN positions mgr_p
  ON mgr_p.id = p.reports_to_position_id
LEFT JOIN employee_assignments mgr_a
  ON mgr_a.position_id = mgr_p.id
  AND mgr_a.end_date IS NULL
  AND mgr_a.is_primary = true
LEFT JOIN employees mgr_e
  ON mgr_e.id = mgr_a.employee_id;
```

> 이 뷰에 `manager_id`와 `manager_name`이 포함되어,
> 기존 API에서 `employees.managerId`를 참조하던 코드가 뷰 전환만으로 동작한다.

---

## 작업 5: company_process_settings (신규)

### 테이블 설계

```sql
CREATE TABLE company_process_settings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID REFERENCES companies(id),  -- NULL = 글로벌 디폴트
  setting_type    TEXT NOT NULL,
                  -- EVALUATION, PROMOTION, COMPENSATION, ATTENDANCE,
                  -- LEAVE, ONBOARDING, RECRUITMENT, BENEFITS
  setting_key     TEXT NOT NULL,
  setting_value   JSONB NOT NULL,
  is_override     BOOLEAN NOT NULL DEFAULT false,  -- 글로벌 디폴트를 오버라이드했는지
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_setting UNIQUE (company_id, setting_type, setting_key)
);

CREATE INDEX idx_settings_company ON company_process_settings(company_id);
CREATE INDEX idx_settings_type ON company_process_settings(setting_type);
```

### 설정 조회 헬퍼 함수

```typescript
// src/lib/process-settings.ts

// ── 설정 조회 (법인별 오버라이드 → 글로벌 폴백) ──
export async function getProcessSetting<T>(
  settingType: SettingType,
  settingKey: string,
  companyId?: string
): Promise<T | null> {
  // 1. 법인별 오버라이드 먼저 조회
  if (companyId) {
    const { data: override } = await supabase
      .from('company_process_settings')
      .select('setting_value')
      .eq('company_id', companyId)
      .eq('setting_type', settingType)
      .eq('setting_key', settingKey)
      .single();
    
    if (override) return override.setting_value as T;
  }
  
  // 2. 글로벌 디폴트 폴백
  const { data: global } = await supabase
    .from('company_process_settings')
    .select('setting_value')
    .is('company_id', null)
    .eq('setting_type', settingType)
    .eq('setting_key', settingKey)
    .single();
  
  return global ? (global.setting_value as T) : null;
}

// ── 특정 타입의 모든 설정 조회 (법인별 + 글로벌 병합) ──
export async function getAllSettingsForType(
  settingType: SettingType,
  companyId: string
): Promise<Record<string, any>> {
  // 1. 글로벌 디폴트 전체
  const { data: globals } = await supabase
    .from('company_process_settings')
    .select('setting_key, setting_value')
    .is('company_id', null)
    .eq('setting_type', settingType);
  
  // 2. 법인별 오버라이드 전체
  const { data: overrides } = await supabase
    .from('company_process_settings')
    .select('setting_key, setting_value')
    .eq('company_id', companyId)
    .eq('setting_type', settingType);
  
  // 3. 병합 (오버라이드가 글로벌을 덮어씀)
  const result: Record<string, any> = {};
  globals?.forEach(g => { result[g.setting_key] = g.setting_value; });
  overrides?.forEach(o => { result[o.setting_key] = o.setting_value; });
  
  return result;
}
```

### TypeScript 타입 정의

```typescript
// src/types/process-settings.ts

export type SettingType = 
  | 'EVALUATION'
  | 'PROMOTION'
  | 'COMPENSATION'
  | 'ATTENDANCE'
  | 'LEAVE'
  | 'ONBOARDING'
  | 'RECRUITMENT'
  | 'BENEFITS';

// ── 각 설정 타입별 JSONB 스키마 ──

export type EvaluationSettings = {
  grading_scale: 'S_A_B_C' | 'S_A_B_C_D' | 'A_B_C_D_E';
  forced_distribution: boolean;
  distribution_rules?: { grade: string; min_pct: number; max_pct: number }[];
  review_sequence: ('SELF' | 'MANAGER' | 'PEER' | 'CALIBRATION')[];
  bei_enabled: boolean;
  mbo_weight: number;     // 0~100
  bei_weight: number;     // 0~100, mbo + bei = 100
};

export type PromotionSettings = {
  min_tenure_by_grade: Record<string, number>;  // { "대리": 3, "과장": 4 }
  requires_evaluation_grade?: string[];          // ["S", "A"]
  requires_consecutive_years?: number;
  approval_chain: string[];                      // ["TEAM_LEAD", "DIVISION_HEAD", "HR_COMMITTEE"]
};

export type CompensationSettings = {
  salary_bands: { 
    grade_code: string; 
    min: number; 
    max: number; 
    currency: string;
  }[];
  raise_matrix?: { 
    eval_grade: string; 
    band_position: 'LOW' | 'MID' | 'HIGH'; 
    raise_pct: number;
  }[];
  bonus_rules?: Record<string, any>;
};

export type AttendanceSettings = {
  work_hours_per_day: number;
  work_days_per_week: number;
  weekly_hour_limit: number;         // 한국: 52
  overtime_requires_approval: boolean;
  shift_enabled: boolean;
  shift_patterns?: { name: string; start: string; end: string }[];
};

export type LeaveSettings = {
  leave_types: { 
    code: string; 
    name: string; 
    paid: boolean; 
    default_days: number;
  }[];
  accrual_rules: { 
    tenure_years: number; 
    annual_days: number;
  }[];
  carryover_max_days: number;
  carryover_expiry_months: number;
};

export type OnboardingSettings = {
  probation_period_months: number;
  checklist_template_id?: string;
  required_documents: string[];
  buddy_assignment: boolean;
};

export type RecruitmentSettings = {
  pipeline_stages: string[];
  approval_required: boolean;
  approval_chain: string[];
  ai_screening_enabled: boolean;
};

export type BenefitsSettings = {
  eligible_programs: string[];
  annual_budget_per_employee?: number;
  currency: string;
};
```

### 시드 데이터

```
글로벌 디폴트 (company_id = NULL):
├── EVALUATION: 4등급(S/A/B/C), 강제배분 on, MBO 70% + BEI 30%
├── PROMOTION: 직급별 최소 체류연수 (대리 3년, 과장 4년, 차장 4년)
├── COMPENSATION: 기본 연봉 밴드 (KRW 기준)
├── ATTENDANCE: 8시간/일, 5일/주, 52시간 상한
├── LEAVE: 기본 연차 15일, 이월 5일
├── ONBOARDING: 수습 3개월, 버디 배정 on
├── RECRUITMENT: 8단계 파이프라인, AI 스크리닝 on
└── BENEFITS: 기본 복리후생 프로그램

CTR-KR 오버라이드:
├── ATTENDANCE: 52시간 엄격 준수
├── LEAVE: 한국 근로기준법 연차 (1년 미만 월 1개, 이후 15일 + 가산)
└── ONBOARDING: 4대보험 신고, 취업규칙 안내

CTR-CN 오버라이드:
├── LEAVE: 춘절 7일 + 근속별 5/10/15일
└── ATTENDANCE: 중국 법정 근무시간

CTR-US 오버라이드:
├── EVALUATION: 5등급(A/B/C/D/E), 강제배분 off, MBO 100%
├── LEAVE: PTO 통합제
├── COMPENSATION: USD 연봉 밴드
└── ONBOARDING: I-9, W-4, 401k 안내

CTR-RU 오버라이드:
├── LEAVE: 러시아 법정 연차 28일
└── ONBOARDING: 군복무 관련 서류

CTR-VN 오버라이드:
├── LEAVE: 베트남 법정 연차 12일
└── ONBOARDING: 노동계약서 공증

CTR-MX 오버라이드:
├── LEAVE: 멕시코 법정 연차 (근속별 12일~)
└── COMPENSATION: MXN 연봉 밴드
```

---

## 구현 명세

### 작업 범위 (이번 세션)
1. ✅ jobs 테이블 생성 + 시드 데이터
2. ✅ positions 테이블 생성 + 시드 데이터 + 보고라인 설정
3. ✅ employee_assignments.position_id FK 설정 + 기존 assignment에 position 매핑
4. ✅ 기존 manager_id 데이터 → Position 보고라인 변환
5. ✅ current_employee_view 업데이트 (Position/Job/매니저 조인)
6. ✅ company_process_settings 테이블 생성 + 시드 데이터
7. ✅ 헬퍼 함수 추가 (매니저 조회, 설정 조회)
8. ✅ 타입 정의
9. ❌ API 수정 (A2-3)

### 파일 변경 계획

#### 신규 생성
```
prisma/migrations/YYYYMMDD_positions_jobs/migration.sql
prisma/migrations/YYYYMMDD_process_settings/migration.sql
src/lib/process-settings.ts          — 법인별 설정 조회 헬퍼
src/types/process-settings.ts        — 설정 타입 정의
src/types/position.ts                — Position/Job 타입 정의
```

#### 수정
```
prisma/schema.prisma                  — Job, Position, CompanyProcessSetting 모델 추가
src/lib/assignments.ts                — 매니저/부하 조회 헬퍼 추가
```

---

## 실행 순서

```
1.  prisma/schema.prisma 현재 상태 확인 (A2-1 결과)
2.  Job 모델 추가 (Prisma)
3.  Position 모델 추가 (Prisma)
4.  CompanyProcessSetting 모델 추가 (Prisma)
5.  마이그레이션 생성 + 실행
6.  Job 시드 데이터 생성 (글로벌 공통 + 법인별)
7.  Position 시드 데이터 생성 (6개 법인 × 부서별)
8.  Position 보고라인 설정 (기존 manager_id 참조 + 부서 구조 기반)
9.  employee_assignments에 position_id 매핑
10. current_employee_view 업데이트 (DROP + CREATE OR REPLACE)
11. company_process_settings 시드 데이터 생성 (글로벌 + 6개 법인 오버라이드)
12. src/lib/assignments.ts 헬퍼 함수 추가
13. src/lib/process-settings.ts 생성
14. src/types/ 타입 파일 생성
15. npx prisma generate
16. 뷰 검증: SELECT * FROM current_employee_view LIMIT 5 (manager_id/manager_name 포함 확인)
17. 빌드 시도 — 에러 목록 업데이트 (A2-1 에러 + 신규 에러)
```

---

## 주의사항

1. **Position 시드 순서**: 상위 Position 먼저 생성 후 하위 생성 (reports_to FK 때문)
2. **순환 참조 방지**: Position 보고라인이 순환하지 않도록 검증 쿼리 실행
3. **매니저 매핑 불완전 허용**: 기존 manager_id를 100% Position으로 변환할 수 없으면, 변환 못 한 건수를 기록하고 넘어감. B2에서 Admin UI로 수동 매핑 가능
4. **company_process_settings 시드**: B1에서 본격 사용하므로, 이번 세션에서는 주요 설정만 시드. 세부 조정은 B1에서
5. **current_employee_view 필드명**: A2-1에서 만든 뷰의 필드명을 유지하면서 신규 필드 추가. 기존 필드 제거/변경 금지
6. **A2-1 보존 manager_id 데이터**: Position 매핑 완료 후 임시 테이블/컬럼 삭제 가능. 단, 매핑 불완전 시 보존

---

## 완료 기준

- [ ] jobs 테이블 생성 + 시드 데이터 (글로벌 15~20 + 법인별)
- [ ] positions 테이블 생성 + 시드 데이터 (200~300개)
- [ ] Position 보고라인 설정 완료 (reports_to_position_id)
- [ ] dotted_line_position_id 샘플 설정 (CTR-KR, CTR-CN 일부)
- [ ] employee_assignments.position_id FK 설정 + 데이터 매핑
- [ ] current_employee_view에서 manager_id, manager_name, position_title, job_title 반환 확인
- [ ] company_process_settings 테이블 + 시드 (글로벌 8개 타입 + 6개 법인 오버라이드)
- [ ] src/lib/assignments.ts — getManagerByPosition, getDirectReports, getDottedLineManager 추가
- [ ] src/lib/process-settings.ts — getProcessSetting, getAllSettingsForType 추가
- [ ] `npx prisma generate` 성공
- [ ] 빌드 에러 목록 업데이트
- [ ] context.md 업데이트 완료

---

## 세션 마무리 (반드시 실행)

### context.md 업데이트
세션 완료 후 `context.md`에 아래 내용을 반영한다:

1. **리팩토링 마스터플랜 진행 현황** — A2-2 상태를 `✅ 완료`로 변경
2. **A2-2 작업 결과 섹션 추가:**
   - 생성된 테이블 목록 + 시드 데이터 건수
   - Job 수, Position 수, Process Settings 수
   - Position 보고라인 매핑 완료율
   - manager_id 변환 불완전 건수 (있으면)
   - 빌드 에러 목록 업데이트 (A2-1 + A2-2 통합)
3. **다음 작업** — A2-3 상태를 `🔄 다음 실행 대기`로 변경
