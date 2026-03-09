# Phase A2-3: API 전환 + 빌드 복구

## 참조 문서 (세션 시작 시 반드시 읽기)
- `context.md` — A2-1 + A2-2 빌드 에러 목록 (이 세션의 작업 목록)
- `src/lib/assignments.ts` — assignment 헬퍼 함수
- `src/lib/process-settings.ts` — 법인별 설정 헬퍼
- `prisma/schema.prisma` — A2-2 이후 최종 스키마

---

## 미션
A2-1/A2-2에서 발생한 빌드 에러를 전부 수정하여 **빌드 성공 상태로 복구**한다.
핵심 전략: 42개 API에서 `employees` 직접 참조 → `current_employee_view` 또는 헬퍼 함수로 전환.

---

## 전제 조건 (A2-1 + A2-2 완료 상태)
- ✅ employee_assignments 테이블 + 데이터 이관 완료
- ✅ employees에서 8개 필드 제거 완료
- ✅ positions, jobs 테이블 + 시드 완료
- ✅ company_process_settings 테이블 + 시드 완료
- ✅ current_employee_view (Position/Job/매니저 조인 포함)
- ✅ 헬퍼 함수 (assignments.ts, process-settings.ts)
- ⚠️ 빌드 에러 상태 — context.md의 에러 목록 참조

---

## 전환 전략

### 3가지 수정 패턴

모든 에러는 아래 3가지 패턴 중 하나로 수정된다:

#### 패턴 A: 뷰 참조 전환 (가장 많음)
employees 테이블을 읽기만 하는 API → `current_employee_view`로 테이블명 교체

```typescript
// BEFORE
const { data } = await supabase
  .from('employees')
  .select('*, department:departments(*)');

// AFTER
const { data } = await supabase
  .from('current_employee_view')
  .select('*');
// ⚠️ 뷰에서는 nested relation select가 안 될 수 있음
// 필요 시 별도 조인 쿼리 또는 헬퍼 함수 사용
```

#### 패턴 B: 헬퍼 함수 사용
특정 직원의 부서/직급/매니저를 가져오는 로직 → 헬퍼 호출

```typescript
// BEFORE
const employee = await getEmployee(id);
const managerId = employee.managerId;
const departmentId = employee.departmentId;

// AFTER
import { getCurrentAssignment, getManagerByPosition } from '@/lib/assignments';
const assignment = await getCurrentAssignment(id);
const manager = await getManagerByPosition(id);
const departmentId = assignment?.departmentId;
```

#### 패턴 C: 인사 변동 로직 추가
직원의 부서/직급/상태를 변경하는 API → `createAssignment` 호출 추가

```typescript
// BEFORE
await supabase
  .from('employees')
  .update({ departmentId: newDeptId, jobGradeId: newGradeId })
  .eq('id', employeeId);

// AFTER
import { createAssignment } from '@/lib/assignments';
await createAssignment({
  employeeId,
  effectiveDate: new Date().toISOString().split('T')[0],
  changeType: 'TRANSFER',
  companyId: currentAssignment.companyId,
  departmentId: newDeptId,
  jobGradeId: newGradeId,
  jobCategoryId: currentAssignment.jobCategoryId,
  employmentType: currentAssignment.employmentType,
  status: currentAssignment.status,
  positionId: newPositionId, // 있으면
  reason: '부서 이동',
});
```

---

## 모듈별 수정 가이드

### context.md의 에러 목록을 기준으로 작업하되, 아래 모듈별 가이드를 참조한다.

### 1. Core HR (employees, org)
**예상 파일:** `src/app/api/v1/employees/`, `src/app/api/v1/org/`
- 직원 목록 조회 → 패턴 A (current_employee_view)
- 직원 상세 조회 → 패턴 A + 필요 시 assignment 이력 별도 조회
- 직원 생성 → 패턴 C (employees INSERT + createAssignment 동시)
- 직원 수정 (인사정보) → 패턴 C (assignment 생성)
- 직원 수정 (개인정보 name/email 등) → employees 직접 UPDATE (변경 없음)
- 조직도 → 패턴 A (뷰에서 department_id 참조)

### 2. 근태/휴가 (attendance, leave)
**예상 파일:** `src/app/api/v1/attendance/`, `src/app/api/v1/leave/`
- 대부분 employee_id 기반 조회 → employees 조인 부분만 뷰로 전환 (패턴 A)
- 부서별 근태 현황 → 뷰의 department_id 사용

### 3. 성과관리 (performance)
**예상 파일:** `src/app/api/v1/performance/`
- 평가 대상자 목록 → 패턴 A (뷰에서 department_id, job_grade_id)
- 매니저의 팀원 목록 → 패턴 B (getDirectReports)
- 캘리브레이션 → 뷰에서 job_grade_id 참조

### 4. 채용 (recruitment)
**예상 파일:** `src/app/api/v1/recruitment/`
- 채용 담당자/면접관 조회 → 패턴 A
- 지원자→직원 전환 시 → 패턴 C (employees INSERT + createAssignment)

### 5. 온보딩/오프보딩 (onboarding, offboarding)
**예상 파일:** `src/app/api/v1/onboarding/`, `src/app/api/v1/offboarding/`
- 신규 입사자 온보딩 → 패턴 A (뷰에서 status, department_id)
- 퇴직 처리 → 패턴 C (status → TERMINATED assignment 생성)

### 6. 급여/보상 (payroll, compensation)
**예상 파일:** `src/app/api/v1/payroll/`, `src/app/api/v1/compensation/`
- 급여 대상자 목록 → 패턴 A (뷰에서 company_id, employment_type)
- 보상 이력 → CompensationHistory 그대로 (변경 없음)

### 7. 애널리틱스 (analytics)
**예상 파일:** `src/app/api/v1/analytics/`
- 이직률/인원 통계 → 패턴 A (뷰에서 department_id, status, company_id)
- 부서별 분석 → 뷰의 department_id 그룹핑

### 8. 기타 (discipline, benefits, training, succession, compliance)
- 대부분 employee_id 기반 → employees 조인만 뷰로 전환 (패턴 A)

### 9. 대시보드/매니저 허브
**예상 파일:** `src/app/api/v1/dashboard/`, `src/app/api/v1/manager-hub/`
- 팀원 목록 → 패턴 B (getDirectReports)
- KPI 집계 → 패턴 A (뷰)

### 10. 설정 (settings)
- 직원 관련 설정 → 대부분 변경 없음
- 조직 설정에서 employees 참조 시 → 패턴 A

---

## 프론트엔드 수정

API 응답 shape이 동일하면 프론트엔드 수정은 최소화된다.
단, 아래 경우는 확인 필요:

```
1. employees 테이블을 직접 참조하는 타입 정의
   → src/types/index.ts에서 Employee 타입이 departmentId 등을 포함하면 수정
   → CurrentEmployee 타입을 새로 정의하거나 기존 타입에 뷰 필드 반영

2. Prisma 생성 타입을 직접 쓰는 컴포넌트
   → Prisma의 Employee 타입에서 8개 필드가 빠졌으므로 에러 발생
   → CurrentEmployee 또는 EmployeeWithAssignment 타입으로 전환

3. 사이드바/헤더에서 현재 유저의 부서/직급 표시
   → useAuth 훅에서 반환하는 유저 객체 확인
```

### 타입 수정 가이드

```typescript
// src/types/index.ts에 추가

// 뷰에서 반환하는 타입 (기존 Employee + assignment 필드)
export type CurrentEmployee = {
  // employees 테이블 필드
  id: string;
  employeeNumber: string;
  name: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  nationality?: string;
  hireDate: string;
  terminationDate?: string;
  attritionRiskScore?: number;
  isHighPotential?: boolean;
  createdAt: string;
  updatedAt: string;
  
  // assignment 필드 (뷰에서 조인)
  companyId: string;
  departmentId?: string;
  jobGradeId?: string;
  jobCategoryId?: string;
  employmentType: string;
  contractType?: string;
  status: string;
  positionId?: string;
  isPrimary?: boolean;
  
  // Position/Job (뷰에서 조인)
  positionTitle?: string;
  positionCode?: string;
  jobId?: string;
  jobTitle?: string;
  jobCode?: string;
  isKeyPosition?: boolean;
  
  // 매니저 (뷰에서 역참조)
  managerId?: string;
  managerName?: string;
};
```

---

## 실행 순서

```
1.  context.md에서 A2-1 + A2-2 빌드 에러 목록 확인
2.  npm run build 실행 → 전체 에러 목록 최신화
3.  에러를 모듈별로 분류 (위 가이드 참조)
4.  src/types/index.ts — CurrentEmployee 타입 추가
5.  패턴 A 적용: 읽기 전용 API → current_employee_view 전환
    (가장 많으므로 먼저 처리 — 대량 에러 해소)
6.  패턴 B 적용: 매니저/팀원 조회 → 헬퍼 함수 전환
7.  패턴 C 적용: 인사 변동 API → createAssignment 추가
8.  프론트엔드 타입 에러 수정
9.  npm run build — 에러 0 목표
10. npx tsc --noEmit — 타입 에러 0 목표
11. 최종 검증: 주요 페이지 5개 라우트 정상 접근 확인
```

### 검증 우선순위 페이지
```
1. /employees (직원 목록) — 패턴 A 대표
2. /employees/[id] (직원 상세) — 패턴 A + 프로필
3. /manager-hub (매니저 허브) — 패턴 B (팀원 목록)
4. /attendance (근태 관리) — 패턴 A + 부서 필터
5. /performance (성과 관리) — 패턴 A + B 복합
```

---

## 주의사항

1. **뷰에서 Supabase nested select 제한**: `current_employee_view`에서 `select('*, department:departments(*)')` 같은 nested relation이 안 될 수 있음. 이 경우 뷰에 필요한 필드를 직접 포함하거나, 별도 쿼리로 분리
2. **Prisma vs Supabase Client 분리**: Prisma ORM을 쓰는 API와 Supabase Client를 쓰는 API가 혼재할 수 있음. 뷰는 Supabase Client에서만 접근 가능하므로, Prisma 쿼리는 raw SQL 또는 Prisma view 지원 활용
3. **createAssignment 트랜잭션**: 인사 변동 시 이전 assignment 종료 + 새 assignment 생성이 원자적이어야 함. Supabase의 `rpc`로 트랜잭션 처리하거나, 에러 시 롤백 로직 포함
4. **기존 EmployeeHistory 로직 유지**: 일부 API에서 EmployeeHistory에 기록하는 로직이 있을 수 있음. 이 로직은 건드리지 않음 (감사 로그로 보존)
5. **점진적 수정**: 42개 API를 한 번에 다 고치려 하지 말고, 모듈별로 수정 → 빌드 → 확인 사이클. 한 모듈씩 에러를 줄여나감
6. **Supabase RLS**: current_employee_view는 뷰이므로 RLS가 직접 안 걸림. 기존 API 레이어의 권한 체크 로직이 유지되는지 확인. 필요 시 `security_invoker = true` 설정

---

## 완료 기준

- [ ] `npm run build` 성공 (0 에러)
- [ ] `npx tsc --noEmit` 0 에러
- [ ] 직원 목록 API 정상 (current_employee_view 경유)
- [ ] 직원 상세 API 정상 (뷰 + assignment 이력)
- [ ] 매니저 허브 API 정상 (getDirectReports)
- [ ] 직원 생성 시 employee + assignment 동시 생성 확인
- [ ] 인사 변동 시 createAssignment로 이력 생성 확인
- [ ] CurrentEmployee 타입 사용으로 프론트엔드 에러 해소
- [ ] 기존 EmployeeHistory 로직 정상 동작 확인
- [ ] context.md 업데이트 완료

---

## 세션 마무리 (반드시 실행)

### context.md 업데이트
세션 완료 후 `context.md`에 아래 내용을 반영한다:

1. **리팩토링 마스터플랜 진행 현황** — A2-3 상태를 `✅ 완료`로 변경
2. **A2 전체 완료 요약 섹션 추가:**
   - 최종 스키마 변경 사항 (테이블 수 변화)
   - 수정된 API 파일 수
   - 빌드 검증 결과 (tsc 0 에러, build 성공)
   - 패턴별 적용 건수 (A: n건, B: n건, C: n건)
   - 잔존 이슈 (있으면)
3. **코드베이스 통계 업데이트** — 모델 수, API 수 등 변경 반영
4. **다음 작업** — B1 상태를 `🔄 다음 실행 대기`로 변경

### CLAUDE.md 업데이트
A2 완료로 데이터 모델이 크게 변경되었으므로:

1. **§6 RBAC 구조** 하단에 `## 데이터 모델 핵심 변경` 섹션 추가:
   - employee_assignments (Effective Dating)
   - positions / jobs (직위/직무 분리)
   - current_employee_view (호환성 뷰)
   - company_process_settings (법인별 설정)
2. **§8 코딩 컨벤션 파일 구조**에 추가:
   ```
   src/lib/assignments.ts        — assignment CRUD + 매니저 조회
   src/lib/process-settings.ts   — 법인별 설정 조회
   src/types/assignment.ts       — EmployeeAssignment, ChangeType
   src/types/position.ts         — Position, Job
   src/types/process-settings.ts — SettingType, EvaluationSettings 등
   ```
