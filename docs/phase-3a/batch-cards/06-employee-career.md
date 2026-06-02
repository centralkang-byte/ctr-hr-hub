# Phase 3a · Batch 06 — 직원 경력 데이터 (격상 트랙)

> **범위**: 풀스택 데이터 트랙 (3 model + RESTful 4 API endpoint × 3 + UI 4 섹션)
> **격상 일자**: 2026-05-21 (Session 228)
> **Stage 1 audit**: `ff8307fd` (`06-employee-career-stage1.md`)
> **base proto SHA**: `HR Hub.html` 동결본
> **base codebase SHA**: `1260a95f` (main 동결)
> **batch ID 컨벤션**: `CR-001` ~ `CR-015` (Stage 1 inventory 재사용)

---

## §0. 1분 요약

- **4 섹션** (학력 / 자격증 / 교육 이수 / 사내 활동)
- **15 findings** (HIGH 5 / MED 7 / LOW 3) — Stage 1 cross-ref
- **Paradigm**: 풀스택 데이터 트랙 (schema + API + UI + i18n + a11y SSOT)
- **Q1-Q6 결정**: 3 신규 model + TrainingEnrollment 재사용 + RESTful per model + career tab 단일 surface + drawer SSOT + 점진 폐기 (Q5=B 사용자 결재) + i18n 5 locale + drawer a11y SSOT
- **RECORD N+37~N+42** 6건 사양화
- **Cross-batch 의존성**: N+41 ← batch 04 N+18 머지 + ~1주 안정화 (Q5=B), N+41/N+42 ← batch 08 N+44 (drawer a11y SSOT)

---

## §1. Surface 인벤토리

Stage 1 §1 cross-ref (`06-employee-career-stage1.md`). 압축 표:

| # | 섹션 | proto data 패턴 | codebase 모델 |
|---|---|---|---|
| 1 | 학력 | school/major/period/status (3 entries inline) | **EmployeeEducation 신규** (CR-001) |
| 2 | 자격증 | name/issuer/acquiredAt/expiresAt(derived status) (5 entries) | **EmployeeCertification 신규** (CR-001) |
| 3 | 교육 이수 | course/hours/type/date/status (5 entries, type 법정/내부/외부) | **TrainingEnrollment 재사용** ✅ (CR-003) |
| 4 | 사내 활동 | 단순 string chip array (5 entries) | **EmployeeActivity 신규** (CR-008) |

### batch 04 EM-004 cross-ref

batch 04 EM-004 (career 탭 전체 하드코딩) → 영구 해결책 (본 batch 06).

### TrainingEnrollment 재사용 매핑

| proto type | codebase TrainingEnrollment.source | enum |
|---|---|---|
| 법정 | `mandatory_auto` | ✅ |
| 내부 | `manual` / `onboarding` | ✅ |
| 외부 | `manual` (외부 provider) | ✅ |

→ 별도 신규 model 신설 0 (CR-003)

---

## §2. Findings (Stage 1 inventory 재사용)

Stage 1 §5 cross-ref. 핵심 HIGH 5건 발췌:

| ID | Surface | 우선 | 핵심 |
|---|---|---|---|
| **CR-001** | schema 전체 | HIGH | Education/Certification/Activity 0건 — 3 신규 model 필요 |
| **CR-002** | proto 4 섹션 | HIGH | inline mock 데이터 (data.js SSOT 이동, batch 04 EM-004 동반) |
| **CR-003** | 교육 섹션 | HIGH | TrainingEnrollment 재사용 가능 (source enum 매핑) |
| **CR-004** | 4 섹션 입력 UI | HIGH | proto inline only, drawer form 신설 필요 |
| **CR-005** | 자격증 status | HIGH | derived field (DB 미저장, expiresAt 기반) |

MED 7건 (CR-006~CR-012) + LOW 3건 (CR-013~CR-015) = Stage 1 audit 그대로 적용.

---

## §3. Cross-surface SSOT 결함

| ID | 항목 | 권고 |
|---|---|---|
| X1 | batch 04 EM-004 (career 탭 inline) | 본 batch 06 풀스택 = 영구 해결책 |
| X2 | batch 04 N+18 graceful empty 우회로 | Q5=B 점진 폐기 (~1주 안정화 후) |
| X3 | 교육 섹션 ↔ TrainingEnrollment 재사용 (CR-003) | source enum 매핑 layer (별도 schema 변경 0) |
| X4 | drawer form a11y SSOT cross-batch | batch 08 N+44 SSOT 정합 (Q4=A + Q6 정합) |
| X5 | 자격증 derived status (DB 미저장) | service layer 또는 client 계산 (Q1=A 결정 정합) |

---

## §4. Proto vs Codebase Gap

| 항목 | proto | codebase | gap |
|---|---|---|---|
| 학력 model | inline 3 entries | ❌ 0건 | EmployeeEducation 신규 |
| 자격증 model | inline 5 entries | ❌ 0건 | EmployeeCertification 신규 |
| 교육 model | inline 5 entries | ✅ TrainingEnrollment 재사용 | source enum 매핑 layer |
| 사내활동 model | inline chip (string only) | ❌ 0건 | EmployeeActivity 신규 + 4 필드 확장 |
| 입력 UI | ❌ 부재 | ❌ 부재 | drawer form 신설 (batch 08 N+44 a11y SSOT) |
| i18n 5 locale | 한국어 literal | ❌ | ~150 키 신설 |

→ **codebase paradigm leader 부분** (TrainingEnrollment 재사용) + **신규 신설 다수** (3 model + UI + i18n)

---

## §5. i18n / a11y / 다크 cross-cutting

### i18n
- **5 locale × ~150 키 신설** (Q6=A 결정)
- 4 섹션 라벨 + 3 enum values (EducationDegree 6 + EducationStatus 4 + ActivityType 7) + 자격증 status (3 derived) + chip status + form labels + button labels = ~30 × 5 = 150 entries
- namespace: `employees.career.*` (educations / certifications / trainings / activities)

### a11y
- **drawer form a11y SSOT** = batch 08 N+44 정합 (Radix Dialog focus trap + ARIA + Esc + focus-visible)
- 4 섹션 입력 drawer 모두 동일 SSOT 적용
- form validation a11y (`aria-invalid` + `aria-describedby` error message)

### 다크
- Phase 4 다크 트랙 합본 inventory entry (별도, 본 batch 진입 0)

---

## §6. Stage 3 게이트 통과 박스 + Q1-Q6 결정 매트릭스

> **Stage 3 게이트 통과 (2026-05-22 KST, 가디언 default + 사용자 결재 부분 round)**
> Q1-Q4 + Q6 = **가디언 default 채택** (5건 data-decidable, batch 05/08 paradigm 정합).
> ⭐ **Q5 = 사용자 결재 round → 옵션 B (점진 폐기) 채택** (2026-05-22, batch 08 N+46 (b) 분할 패턴 정합).
> 가디언 메타룰: "정합성 데이터로 결정 가능한 의제 = default 채택, **trade-off 의제 = 사용자 결재**" 적용.
> Q5 trade-off 의제 사유: N+18 graceful empty 폐기 시점 = production EmptyState 노출 명백성 vs 회귀 격리 trade-off → 사용자 결재 필수.

| Q | 결정 | 결정 주체 | Stage 4 입력 |
|---|---|---|---|
| Q1 Schema design | **A** | 가디언 default | 3 신규 model (Education/Certification/Activity) + TrainingEnrollment 재사용 (교육 섹션) |
| Q2 API 패턴 | **A** | 가디언 default | RESTful per model (12 endpoints: 3 model × 4 method) |
| Q3 UI surface | **A** | 가디언 default | career tab 단일 surface 4 섹션 (batch 04 7탭 결정 정합) |
| Q4 입력 패턴 | **A** | 가디언 default | drawer SSOT (batch 08 N+44 drawer a11y SSOT 정합) |
| **Q5 N+18 폐기** ⭐ | **B** | **사용자 결재** | **점진 폐기** (N+18 implementation → 안정화 ~1주 → batch 06 별도 PR). batch 08 N+46 (b) 분할 패턴 정합 |
| Q6 i18n + a11y | **A** | 가디언 default | 5 locale ~150 키 신설 + drawer a11y SSOT (batch 08 N+44 적용) |

---

## §7. RECORD N+37~N+42 plan body 사양화

**Stage 3 게이트 통과 후 promote 완료 (2026-05-22).**

| RECORD | 묶음 finding | 우선 | 트랙 | 의존성 |
|---|---|---|---|---|
| **N+37** | CR-001 + CR-006 + CR-008 (3 model + 3 enum + RLS + migration) + Q1 | HIGH | Prisma migration + RLS (선행) | 0 |
| **N+38** | EmployeeEducation API (RESTful CRUD) + Q2 | HIGH | codebase | N+37 |
| **N+39** | EmployeeCertification API + CR-005 derived status + CR-007 S3 + Q2 | MEDIUM | codebase | N+37 |
| **N+40** | EmployeeActivity API + Q2 | MEDIUM | codebase | N+37 |
| **N+41** | UI 4 섹션 + drawer form + 교육 섹션 TrainingEnrollment 매핑 + N+18 우회로 폐기 + Q3/Q4/Q5=B | HIGH | codebase + cross-batch | N+37/N+38/N+39/N+40 + **batch 04 N+18 머지 + ~1주 안정화** + batch 08 N+44 |
| **N+42** | i18n 5 locale + a11y SSOT 검증 + N+18 우회로 코드 0 remaining + Q6 | LOW | codebase + docs | N+41 머지 후 (최후) |

---

### N+37 — Schema 신설 (Q1 결정, 선행) [HIGH]

- **트랙**: Prisma migration + RLS
- **우선**: HIGH
- **의존성**: 0 (선행 RECORD)
- **Stage 4 입력**:
  - **3 신규 model** (`prisma/schema.prisma`):
    ```prisma
    model EmployeeEducation        // school/major/degree/startDate/endDate/status/certificateUrl
    model EmployeeCertification    // name/issuer/credentialNo/acquiredAt/expiresAt/certificateUrl
    model EmployeeActivity         // type/title/description/startDate/endDate
    ```
  - **3 신규 enum**:
    ```prisma
    enum EducationDegree { HIGH_SCHOOL / ASSOCIATE / BACHELOR / MASTER / DOCTORATE / OTHER }
    enum EducationStatus { GRADUATED / ATTENDING / WITHDRAWN / COMPLETED }
    enum ActivityType    { VOLUNTEER / CLUB / WORKING_GROUP / PRESENTATION / MENTOR / COMMITTEE / OTHER }
    ```
  - **Employee 1:N relation** (3 모델 모두 employeeId + companyId)
  - **RLS policy**: companyId scope (기존 패턴 정합, year_end_settlements pattern cross-ref)
  - **migration script**: `prisma migrate dev --name add_employee_career_models`
  - **idempotent seed**: 신규 모델 = 빈 테이블 (seed 0)
  - **TrainingEnrollment 재사용 (CR-003)**: schema 변경 0
- **Stage 4 검증**:
  - vitest schema 단위 (CRUD operations)
  - migration rollback 시나리오 (`prisma migrate reset`)
  - RLS policy 검증 (cross-company scope 격리)
  - `npx prisma migrate status` = up to date
- **블로커**: PR-5A 머지 후 진입

---

### N+38 — EmployeeEducation API (Q2 결정) [HIGH]

- **트랙**: codebase
- **우선**: HIGH
- **의존성**: N+37 선행 필수
- **Stage 4 입력**:
  - **4 endpoints** (`src/app/api/v1/employees/[id]/education/`):
    - `GET    /api/v1/employees/[id]/education` (list, default sort `endDate DESC NULLS FIRST`)
    - `POST   /api/v1/employees/[id]/education` (create)
    - `PATCH  /api/v1/employees/[id]/education/[recordId]` (update)
    - `DELETE /api/v1/employees/[id]/education/[recordId]` (soft delete via deletedAt)
  - **Zod validation** schema (필수: school/degree/startDate/status, 옵션: major/endDate/certificateUrl)
  - **권한 가드**:
    - HR_ADMIN / SUPER_ADMIN: 전체 access
    - EMPLOYEE: 본인만 (self-service)
    - MANAGER: 팀원 read-only
  - **RLS scope**: `withRLS` wrapper + companyFilter
- **Stage 4 검증**:
  - vitest API 단위 (4 method × 권한 매트릭스)
  - playwright e2e (HR_ADMIN + 본인 + MANAGER 시나리오)
  - 회귀: 다른 `/api/v1/employees/[id]/*` endpoint 무변동

---

### N+39 — EmployeeCertification API + derived status + S3 (Q2 + CR-005 + CR-007) [MEDIUM]

- **트랙**: codebase
- **우선**: MEDIUM
- **의존성**: N+37 선행 필수
- **Stage 4 입력**:
  - **4 endpoints** (`src/app/api/v1/employees/[id]/certifications/`): N+38 패턴 정합
  - **derived status** (CR-005, DB 미저장):
    ```ts
    function computeCertificationStatus(expiresAt: Date | null, now: Date = new Date()): "active" | "expiring" | "expired" {
      if (!expiresAt) return "active"
      const daysUntilExpiry = differenceInDays(expiresAt, now)
      if (daysUntilExpiry < 0) return "expired"
      if (daysUntilExpiry <= 90) return "expiring"  // 90일 default
      return "active"
    }
    ```
    - service layer (`src/lib/employees/career.ts`) 또는 client 계산 (Stage 4 pre-flight 결정)
  - **S3 certificate upload (CR-007, 선택)**:
    - 기존 패턴 `/api/v1/employees/[id]/documents` cross-ref
    - presigned URL upload + `certificateUrl` 저장
    - Stage 4 pre-flight 시 S3 도입 여부 결정 게이트
  - **권한 매트릭스**: N+38 정합
- **Stage 4 검증**:
  - vitest derived status logic (3 case: active/expiring/expired, 90일 boundary)
  - API 회귀 + S3 upload 시나리오 (도입 시)

---

### N+40 — EmployeeActivity API (Q2) [MEDIUM]

- **트랙**: codebase
- **우선**: MEDIUM
- **의존성**: N+37 선행 필수
- **Stage 4 입력**:
  - **4 endpoints** (`src/app/api/v1/employees/[id]/activities/`): N+38 패턴 정합
  - **CR-008 확장 필드**: type (ActivityType enum) + title + description + startDate + endDate
  - **권한 매트릭스**: N+38 정합
- **Stage 4 검증**:
  - vitest API 단위
  - playwright e2e
  - 회귀 0

---

### N+41 — UI 4 섹션 + drawer form + N+18 우회로 폐기 (Q3 + Q4 + Q5=B) [HIGH, cross-batch critical]

- **트랙**: codebase + UI + cross-batch
- **우선**: HIGH
- **의존성**:
  - N+37 / N+38 / N+39 / N+40 선행 필수 (4 API endpoint 머지 완료)
  - ⭐ **batch 04 N+18 implementation 머지 + 안정화 ~1주 후 진입** (Q5=B 점진 폐기)
  - **batch 08 N+44 drawer a11y SSOT** 정합 (Q4=A drawer 패턴)
- **Stage 4 입력**:
  - **career tab 4 섹션 UI** (`src/components/employees/CareerTab.tsx` 또는 `src/app/(dashboard)/employees/[id]/CareerSection.tsx`):
    - 학력 / 자격증 / 교육 이수 / 사내 활동 = 4 sub-component
    - proto visual 패턴 정합 (Card + list/table 혼용)
  - **drawer form SSOT** (batch 08 N+44 + batch 04 N+21 비대상):
    - 4 섹션 공통 drawer (`<EmployeeCareerDrawer type="education|certification|training|activity" recordId={...}>`)
    - 또는 4 섹션 각각 별도 drawer
    - Stage 4 pre-flight 시 결정 (단일 drawer + type switch vs 4 별도)
  - **교육 섹션 = TrainingEnrollment 매핑** (CR-003):
    - `/api/v1/training/enrollments?employeeId=[id]` 재사용 또는 신규 query layer
    - source enum 매핑 layer (서비스 측 또는 client)
    - **schema 변경 0** (별도 endpoint 신설 검토 — Stage 4 pre-flight)
  - **N+18 graceful empty + EmptyState 폐기 (점진, Q5=B)**:
    - **순서**: N+18 implementation 머지 → ~1주 안정화 → 본 N+41 PR 진입
    - 폐기 대상: `CareerTab.tsx` 내 EmptyState 우회로 (batch 04 N+18 결정)
    - 회귀 가드: batch 04 N+18 implementation 회귀 0 확인 후 진입
  - **i18n**: ~150 키 사용 (N+42에서 신설 완료 가정, 또는 N+41 동반)
- **Stage 4 검증**:
  - batch 04 N+18 회귀 0 (graceful empty 폐기 검증)
  - 4 섹션 form 회귀 + drawer a11y (axe-core 0 violation)
  - TrainingEnrollment 데이터 매핑 정합 (교육 섹션 = 기존 데이터 표시)
  - playwright e2e (4 섹션 × CRUD × 권한)
- **블로커**:
  - PR-5A 머지
  - batch 04 N+18 implementation 머지 + ~1주 안정화 (Q5=B 점진 폐기 결정)
  - batch 08 N+44 머지 (drawer a11y SSOT)

---

### N+42 — i18n 5 locale + a11y SSOT 검증 + N+18 우회로 코드 0 remaining (Q6) [LOW, 최후]

- **트랙**: codebase + i18n + docs
- **우선**: LOW
- **의존성**: **N+41 머지 후 최후 진입**
- **Stage 4 입력**:
  - **5 locale × ~150 키 신설** (`messages/{ko,en,zh,vi,es}.json`):
    - namespace `employees.career.*`:
      - `educations.{degree,status,school,major,period,addNew,editTitle}`
      - `certifications.{name,issuer,acquiredAt,expiresAt,status,addNew,editTitle}`
      - `trainings.{course,hours,type,date,status}` (TrainingEnrollment cross-ref)
      - `activities.{type,title,description,period,addNew,editTitle}`
    - 3 enum × locale: `EducationDegree` (6) + `EducationStatus` (4) + `ActivityType` (7)
    - form labels + button labels + chip status
  - **batch 08 N+44 drawer a11y SSOT 검증**:
    - 본 batch UI 4 섹션 drawer 모두 동일 SSOT 적용 확인
    - axe-core 0 violation × 4 섹션
    - keyboard nav (Tab / Esc / focus return)
  - **batch 04 N+18 graceful empty 우회로 코드 0 remaining 검증** (점진 폐기 완료):
    - grep `<EmptyState>` in career-related files = 0
    - N+18 결정에서 신설한 EmptyState 호출 = 0 (또는 다른 의미로 재사용 명시)
- **Stage 4 검증**:
  - i18n: 5 locale × ~150 키 검증 (`npm run i18n:check` 또는 동등 script)
  - a11y: axe-core 0 violation × 4 섹션 drawer
  - **N+18 우회로 코드 0 remaining** (grep evidence)
  - **점진 폐기 완료** (batch 04 N+18 → batch 06 N+41 → N+42 chain)

---

### Phase 4 다크 트랙 합본 (배제)

본 batch = 풀스택 데이터 트랙. 다크 토큰화 무관 (별도 Phase 4 트랙). 본 batch UI 4 섹션 = Workday wt 토큰 사용 (인라인 hex 0).

---

## §8. 다음 액션

1. **Stage 4 pre-flight** (별도 turn)
   - N+37 schema migration plan 상세 (rollback 시나리오, RLS policy 검증)
   - N+39 derived status logic 위치 결정 (service layer vs client)
   - N+39 S3 upload 도입 결정 게이트
   - N+41 drawer 단일 + type switch vs 4 별도 결정
   - N+41 교육 섹션 query layer (별도 endpoint vs 기존 재사용)
2. **Stage 4 implementation** (순서):
   - **선행**: PR-5A 머지 + **batch 04 N+18 implementation 머지 + ~1주 안정화** (Q5=B)
   - N+37 (schema 선행) → N+38 (Education API) → N+39 (Certification API) → N+40 (Activity API) → N+41 (UI + N+18 폐기) → N+42 (i18n + a11y + 우회로 코드 0 verification)
3. **Cross-batch 의존성**:
   - N+41 ← batch 04 N+18 머지 + ~1주 안정화 (Q5=B 점진 폐기)
   - N+41 ← batch 08 N+44 머지 (drawer a11y SSOT)
   - N+42 ← N+41 머지 후 최후 진입

---

## §9. 의존성

### Cross-batch 의존
- ⭐ **batch 04 N+18 implementation 머지 + ~1주 안정화 후 N+41 진입** (Q5=B 점진 폐기, batch 08 N+46 (b) 분할 패턴 정합)
- **batch 08 N+44 drawer form a11y SSOT** 정합 (Q4=A + Q6=A)
- **batch 04 EM-004 영구 해결** (career 탭 inline → 본 batch 06 풀스택 완성)
- **batch 04 N+21 DemoLimitBanner 비대상** (drawer = wizard 아님)
- **batch 04 N+18 결정 정합** (career 탭 7번째 추가 = batch 06 implementation surface)

### 무관
- batch 05 / 07 / 09 무관 (서로 다른 surface)
- proto only RECORD (N+19/20/21/22/23/25/28/29/33/35/36) 무관

### 선행 의존
- **PR-5A 머지** 후 진입 (모든 codebase 트랙)
- **batch 04 N+18 implementation** 머지 + 안정화 (Q5=B)
- **batch 08 N+44 머지** (drawer a11y SSOT)

---

**상태**: ACTIVE (Stage 3 게이트 통과 2026-05-22, RECORD N+37~N+42 사양화 완료, Q1-Q4+Q6 가디언 default + Q5 사용자 결재 = B 점진 폐기)
**다음 갱신**: Stage 4 pre-flight 별도 turn
